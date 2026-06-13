#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SynthBoard — put a custom domain on the Container App and hide the origin
# behind Cloudflare.
#
# Strategy (see azure/README.md for the full runbook):
#   • Bind your domain to the Container App using a Cloudflare ORIGIN certificate
#     (15-year cert, no Let's Encrypt renewal — so it keeps working once the
#     origin is locked down).
#   • Lock the Container App ingress to Cloudflare's published IP ranges so the
#     *.azurecontainerapps.io URL can't be reached directly.
#
# This automates the Azure side. The Cloudflare dashboard steps (DNS records,
# generating the Origin cert, SSL mode, flipping the proxy on) and the Google
# OAuth redirect-URI update are manual — the script pauses and tells you when.
#
# Usage:
#   # fill CUSTOM_DOMAIN, ORIGIN_CERT_FILE, ORIGIN_KEY_FILE in azure/.env.azure
#   ./azure/custom-domain.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.azure"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy azure/.env.azure.example to it and fill it in." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

require() {
  if [[ -z "${!1:-}" ]]; then
    echo "ERROR: required variable '$1' is not set in $ENV_FILE" >&2
    exit 1
  fi
}
for v in RESOURCE_GROUP CONTAINERAPP_NAME CONTAINERAPP_ENV \
         CUSTOM_DOMAIN ORIGIN_CERT_FILE ORIGIN_KEY_FILE; do
  require "$v"
done
for f in "$ORIGIN_CERT_FILE" "$ORIGIN_KEY_FILE"; do
  [[ -f "$f" ]] || { echo "ERROR: file not found: $f" >&2; exit 1; }
done

RG="$RESOURCE_GROUP"
APP="$CONTAINERAPP_NAME"
ENVNAME="$CONTAINERAPP_ENV"
DOMAIN="$CUSTOM_DOMAIN"

az extension add --name containerapp --upgrade --only-show-errors 1>/dev/null || true

# ── 1. Show the DNS records Cloudflare needs (DNS-only / grey cloud for now) ──
VERIFICATION_ID="$(az containerapp show -g "$RG" -n "$APP" \
  --query properties.customDomainVerificationId -o tsv)"
APP_FQDN="$(az containerapp show -g "$RG" -n "$APP" \
  --query properties.configuration.ingress.fqdn -o tsv)"

cat <<EOF

────────────────────────────────────────────────────────────────
STEP 1 — Create these records in the Cloudflare DNS dashboard.
         IMPORTANT: set the CNAME to "DNS only" (GREY cloud) for now so Azure
         can validate ownership. You'll switch it to Proxied later.

   Type   Name                Value                  Proxy
   ────   ─────────────────   ────────────────────   ────────
   CNAME  ${DOMAIN}
            → ${APP_FQDN}   (set to: DNS only)
   TXT    asuid.${DOMAIN}
            → ${VERIFICATION_ID}

   (For an apex/root domain, the CNAME name is "@"; Cloudflare flattens it, and
    the TXT name is "asuid".)
────────────────────────────────────────────────────────────────
EOF
read -r -p "Press ENTER once those records exist and have propagated… "

# ── 2. Upload the Cloudflare Origin cert and bind the hostname ──
echo "==> Packaging the Cloudflare Origin cert as PFX"
PFX_FILE="$(mktemp -u).pfx"
PFX_PW="$(openssl rand -hex 16)"
openssl pkcs12 -export -out "$PFX_FILE" \
  -inkey "$ORIGIN_KEY_FILE" -in "$ORIGIN_CERT_FILE" -passout pass:"$PFX_PW"

CERT_NAME="cloudflare-origin"
echo "==> Uploading certificate to the Container Apps environment"
az containerapp env certificate upload -g "$RG" -n "$ENVNAME" \
  --certificate-file "$PFX_FILE" --password "$PFX_PW" \
  --certificate-name "$CERT_NAME" --only-show-errors 1>/dev/null
rm -f "$PFX_FILE"

echo "==> Adding + binding hostname $DOMAIN (validation via CNAME)"
az containerapp hostname add -g "$RG" -n "$APP" --hostname "$DOMAIN" \
  --only-show-errors 1>/dev/null 2>&1 || true
# --environment is required so the CLI can resolve the uploaded certificate by
# name within the Container Apps environment.
az containerapp hostname bind -g "$RG" -n "$APP" --hostname "$DOMAIN" \
  --environment "$ENVNAME" \
  --certificate "$CERT_NAME" --validation-method CNAME --only-show-errors 1>/dev/null

echo "==> Pointing APP_URL at https://$DOMAIN (OAuth callback + secure cookies)"
az containerapp update -g "$RG" -n "$APP" \
  --set-env-vars "APP_URL=https://$DOMAIN" --only-show-errors 1>/dev/null

cat <<EOF

────────────────────────────────────────────────────────────────
STEP 2 — In Cloudflare now:
   1. Flip the ${DOMAIN} CNAME to "Proxied" (ORANGE cloud).
   2. SSL/TLS → Overview → set encryption mode to "Full (strict)".
────────────────────────────────────────────────────────────────
EOF
read -r -p "Press ENTER once the proxy is ON and SSL mode is Full (strict)… "

# ── 3. Lock the origin: allow only Cloudflare's IP ranges ──
echo "==> Fetching Cloudflare's current IP ranges"
CF_V4="$(curl -fsSL https://www.cloudflare.com/ips-v4)"
CF_V6="$(curl -fsSL https://www.cloudflare.com/ips-v6 || true)"

echo "==> Applying ingress IP allow-list (anything not from Cloudflare is denied)"
i=0
ok=0
fail=0
while read -r cidr; do
  [[ -z "$cidr" ]] && continue
  i=$((i + 1))
  if az containerapp ingress access-restriction set -g "$RG" -n "$APP" \
       --rule-name "cloudflare-$i" --ip-address "$cidr" --action Allow \
       --only-show-errors 1>/dev/null 2>&1; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1))
    echo "   WARN: could not add rule for $cidr" >&2
  fi
done <<< "$CF_V4"$'\n'"$CF_V6"

if (( fail > 0 )); then
  cat >&2 <<EOF

   NOTE: $fail range(s) were rejected. Container Apps caps the number of ingress
   IP rules, and Cloudflare publishes more ranges than may fit. If direct access
   to the origin still needs blocking, use a Cloudflare Tunnel (cloudflared)
   instead of an IP allow-list — see azure/README.md.
EOF
fi

FQDN_NOTE="https://$DOMAIN"
cat <<EOF

────────────────────────────────────────────────────────────────
✅ Custom domain configured.

   Public URL:        $FQDN_NOTE
   Origin (hidden):   $APP_FQDN
   IP allow-list:     $ok Cloudflare range(s) applied

FINAL STEP — Google OAuth:
   Add this redirect URI at https://console.cloud.google.com/apis/credentials :

       $FQDN_NOTE/auth/google/callback

   (Keep or remove the old *.azurecontainerapps.io callback as you like.)
────────────────────────────────────────────────────────────────
EOF
