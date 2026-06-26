#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SynthBoard — one-shot Azure deployment.
#
# Provisions, in a single resource group:
#   • Azure Container Registry (ACR)              — holds the image
#   • Azure Database for PostgreSQL Flexible Server + database
#   • Azure Container Apps environment + one Container App (single container)
#
# The image is built IN THE CLOUD with `az acr build`, so you do NOT need Docker
# installed locally. The whole app (React SPA + Express API) runs in one container.
#
# Usage:
#   cp azure/.env.azure.example azure/.env.azure   # then fill it in
#   ./azure/deploy.sh
#
# Re-running is safe: existing resources are reused and the app is redeployed.
# Requires: az CLI (logged in via `az login`) with a selected subscription.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.azure"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy azure/.env.azure.example to it and fill it in." >&2
  exit 1
fi

# Load config (allow $RANDOM-style expansion in the example to resolve).
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: required variable '$name' is not set in $ENV_FILE" >&2
    exit 1
  fi
}
for v in RESOURCE_GROUP LOCATION ACR_NAME CONTAINERAPP_ENV CONTAINERAPP_NAME \
         PG_SERVER_NAME PG_ADMIN_USER PG_ADMIN_PASSWORD PG_DB_NAME \
         SESSION_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET NVIDIA_API_KEY; do
  require "$v"
done

IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_NAME="synthboard"

echo "==> Ensuring the containerapp + postgres CLI extensions are present"
az extension add --name containerapp --upgrade --only-show-errors 1>/dev/null || true
az provider register --namespace Microsoft.App --wait 1>/dev/null || true
az provider register --namespace Microsoft.OperationalInsights --wait 1>/dev/null || true

echo "==> Resource group: $RESOURCE_GROUP ($LOCATION)"
az group create -n "$RESOURCE_GROUP" -l "$LOCATION" --only-show-errors 1>/dev/null

# ── Container Registry ────────────────────────────────────────
echo "==> Container registry: $ACR_NAME"
az acr create -g "$RESOURCE_GROUP" -n "$ACR_NAME" --sku Basic --admin-enabled true \
  --only-show-errors 1>/dev/null
ACR_LOGIN_SERVER="$(az acr show -n "$ACR_NAME" --query loginServer -o tsv)"

echo "==> Building image in the cloud (az acr build) — no local Docker needed"
az acr build -r "$ACR_NAME" -f "$REPO_ROOT/Dockerfile.azure" \
  -t "${IMAGE_NAME}:${IMAGE_TAG}" "$REPO_ROOT"

# ── Postgres Flexible Server ──────────────────────────────────
echo "==> Postgres Flexible Server: $PG_SERVER_NAME"
if ! az postgres flexible-server show -g "$RESOURCE_GROUP" -n "$PG_SERVER_NAME" \
       --only-show-errors 1>/dev/null 2>&1; then
  az postgres flexible-server create \
    -g "$RESOURCE_GROUP" -n "$PG_SERVER_NAME" -l "$LOCATION" \
    --admin-user "$PG_ADMIN_USER" --admin-password "$PG_ADMIN_PASSWORD" \
    --sku-name "${PG_SKU:-Standard_B1ms}" --tier "${PG_TIER:-Burstable}" \
    --storage-size "${PG_STORAGE_GB:-32}" --version "${PG_VERSION:-16}" \
    --public-access None --yes --only-show-errors 1>/dev/null
fi

# Create the application database as a separate step. Newer az CLI / postgres
# extension versions reject --database-name on `flexible-server create` for a
# standard (non-Elastic) server. Idempotent — ignore "already exists".
echo "==> Database: $PG_DB_NAME"
az postgres flexible-server db create \
  -g "$RESOURCE_GROUP" -s "$PG_SERVER_NAME" -d "$PG_DB_NAME" \
  --only-show-errors 1>/dev/null 2>&1 || true

echo "==> Allowing Azure services (incl. Container Apps) to reach Postgres"
# 0.0.0.0/0.0.0.0 is the special "allow Azure services" firewall rule. For
# production, prefer VNet integration + Private DNS instead of this.
az postgres flexible-server firewall-rule create \
  -g "$RESOURCE_GROUP" -n "$PG_SERVER_NAME" \
  --rule-name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 \
  --only-show-errors 1>/dev/null || true

PG_FQDN="$(az postgres flexible-server show -g "$RESOURCE_GROUP" -n "$PG_SERVER_NAME" \
  --query fullyQualifiedDomainName -o tsv)"

# Percent-encode the credentials so special characters (e.g. / + = from a
# base64 password) don't corrupt the DATABASE_URL and make pg throw
# "Invalid URL". Only unreserved chars pass through untouched.
urlencode() {
  local s="$1" out="" i c
  for (( i = 0; i < ${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) out+="$(printf '%%%02X' "'$c")" ;;
    esac
  done
  printf '%s' "$out"
}
PG_USER_ENC="$(urlencode "$PG_ADMIN_USER")"
PG_PASS_ENC="$(urlencode "$PG_ADMIN_PASSWORD")"
DATABASE_URL="postgres://${PG_USER_ENC}:${PG_PASS_ENC}@${PG_FQDN}:5432/${PG_DB_NAME}"

# ── Container Apps environment ────────────────────────────────
echo "==> Container Apps environment: $CONTAINERAPP_ENV"
if ! az containerapp env show -g "$RESOURCE_GROUP" -n "$CONTAINERAPP_ENV" \
       --only-show-errors 1>/dev/null 2>&1; then
  az containerapp env create -g "$RESOURCE_GROUP" -n "$CONTAINERAPP_ENV" \
    -l "$LOCATION" --only-show-errors 1>/dev/null
fi

ACR_USERNAME="$(az acr credential show -n "$ACR_NAME" --query username -o tsv)"
ACR_PASSWORD="$(az acr credential show -n "$ACR_NAME" --query 'passwords[0].value' -o tsv)"

# Secrets (referenced by env vars via secretref) and plain env vars.
SECRETS=(
  "database-url=$DATABASE_URL"
  "session-secret=$SESSION_SECRET"
  "google-client-id=$GOOGLE_CLIENT_ID"
  "google-client-secret=$GOOGLE_CLIENT_SECRET"
  "nvidia-api-key=$NVIDIA_API_KEY"
)
ENVVARS=(
  "NODE_ENV=production"
  "PORT=3000"
  "SERVE_STATIC=true"
  "DATABASE_SSL=true"
  "DATABASE_URL=secretref:database-url"
  "SESSION_SECRET=secretref:session-secret"
  "GOOGLE_CLIENT_ID=secretref:google-client-id"
  "GOOGLE_CLIENT_SECRET=secretref:google-client-secret"
  "NVIDIA_API_KEY=secretref:nvidia-api-key"
  "LLM_API_KEY_ENV=${LLM_API_KEY_ENV:-NVIDIA_API_KEY}"
  "LLM_BASE_URL=${LLM_BASE_URL:-https://integrate.api.nvidia.com/v1}"
  "LLM_MODEL=${LLM_MODEL:-minimaxai/minimax-m2.7}"
  "LLM_MAX_TOKENS=${LLM_MAX_TOKENS:-8192}"
  "LLM_TEMPERATURE=${LLM_TEMPERATURE:-1}"
  "LLM_TOP_P=${LLM_TOP_P:-0.95}"
  "LLM_TIMEOUT_MS=${LLM_TIMEOUT_MS:-280000}"
  "LLM_MAX_RETRIES=${LLM_MAX_RETRIES:-0}"
  "MAX_VISUALIZATIONS_PER_ACCOUNT=${MAX_VISUALIZATIONS_PER_ACCOUNT:-5}"
  "ADMIN_EMAILS=${ADMIN_EMAILS:-}"
)

echo "==> Deploying Container App: $CONTAINERAPP_NAME"
if az containerapp show -g "$RESOURCE_GROUP" -n "$CONTAINERAPP_NAME" \
     --only-show-errors 1>/dev/null 2>&1; then
  az containerapp registry set -g "$RESOURCE_GROUP" -n "$CONTAINERAPP_NAME" \
    --server "$ACR_LOGIN_SERVER" --username "$ACR_USERNAME" --password "$ACR_PASSWORD" \
    --only-show-errors 1>/dev/null
  az containerapp secret set -g "$RESOURCE_GROUP" -n "$CONTAINERAPP_NAME" \
    --secrets "${SECRETS[@]}" --only-show-errors 1>/dev/null
  az containerapp update -g "$RESOURCE_GROUP" -n "$CONTAINERAPP_NAME" \
    --image "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}" \
    --set-env-vars "${ENVVARS[@]}" --only-show-errors 1>/dev/null
else
  az containerapp create -g "$RESOURCE_GROUP" -n "$CONTAINERAPP_NAME" \
    --environment "$CONTAINERAPP_ENV" \
    --image "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}" \
    --registry-server "$ACR_LOGIN_SERVER" \
    --registry-username "$ACR_USERNAME" --registry-password "$ACR_PASSWORD" \
    --target-port 3000 --ingress external \
    --min-replicas 1 --max-replicas 1 \
    --cpu 0.5 --memory 1.0Gi \
    --secrets "${SECRETS[@]}" \
    --env-vars "${ENVVARS[@]}" \
    --only-show-errors 1>/dev/null
fi

# ── Wire APP_URL to the assigned FQDN (chicken-and-egg: known only post-create) ──
FQDN="$(az containerapp show -g "$RESOURCE_GROUP" -n "$CONTAINERAPP_NAME" \
  --query properties.configuration.ingress.fqdn -o tsv)"
APP_URL="${APP_URL:-https://$FQDN}"

echo "==> Setting APP_URL=$APP_URL"
az containerapp update -g "$RESOURCE_GROUP" -n "$CONTAINERAPP_NAME" \
  --set-env-vars "APP_URL=$APP_URL" --only-show-errors 1>/dev/null

cat <<EOF

────────────────────────────────────────────────────────────────
✅ Deployment complete.

   App URL:            $APP_URL
   Postgres host:      $PG_FQDN
   Container image:    ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}

NEXT STEP — Google OAuth:
   Add this EXACT redirect URI to your OAuth client at
   https://console.cloud.google.com/apis/credentials :

       ${APP_URL}/auth/google/callback

   (If you just added it, sign-in works within a minute or two.)

Redeploy after code changes:  ./azure/deploy.sh
Tail logs:                    az containerapp logs show -g $RESOURCE_GROUP -n $CONTAINERAPP_NAME --follow
────────────────────────────────────────────────────────────────
EOF
