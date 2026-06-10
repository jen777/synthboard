# Deploying SynthBoard to Azure (single container)

This directory contains an **Azure-specific** deployment of SynthBoard that runs
the **entire app in one container** and uses **Azure Database for PostgreSQL
Flexible Server** for storage.

Unlike the default two-container setup (nginx + Node), the Azure image bundles
the React SPA and the Express API into a **single Node process**:

```
┌──────────────────────────────────────────┐        ┌─────────────────────────────┐
│  Container App  (one container)           │        │  PostgreSQL Flexible Server  │
│  ┌────────────────────────────────────┐   │ ─────▶ │  <name>.postgres.database.   │
│  │  Express  →  /api, /auth            │   │  TLS   │  azure.com:5432              │
│  │            →  static React SPA (/)  │   │        └─────────────────────────────┘
│  └────────────────────────────────────┘   │
│  HTTPS ingress (managed TLS)  :3000        │
└──────────────────────────────────────────┘
```

- Express serves the built SPA and proxies nothing — `/api`, `/auth`, and the
  app are all **same-origin**, so the session cookie works without nginx.
- Azure Container Apps provides **managed HTTPS ingress** and sets
  `X-Forwarded-Proto: https`; the server already trusts the proxy, so secure
  session cookies and the Google OAuth callback work over HTTPS out of the box.
- Postgres requires TLS; `DATABASE_SSL=true` is set automatically.

## What gets created

In a single resource group:

| Resource | Purpose |
| --- | --- |
| Azure Container Registry (ACR) | Holds the image (built in the cloud). |
| PostgreSQL Flexible Server + database | The application database. |
| Container Apps environment + Container App | Runs the single container with HTTPS ingress. |

## Files

| File | What it is |
| --- | --- |
| [`../Dockerfile.azure`](../Dockerfile.azure) | Single-container image (SPA + API). |
| [`deploy.sh`](./deploy.sh) | One-shot provision + deploy via Azure CLI (recommended). |
| [`main.bicep`](./main.bicep) | Declarative IaC alternative. |
| [`.env.azure.example`](./.env.azure.example) | Config template — copy to `.env.azure`. |

## Prerequisites

1. **Azure CLI** installed and logged in: `az login`, then
   `az account set --subscription <id>`.
2. **Google OAuth credentials** — https://console.cloud.google.com/apis/credentials
3. **NVIDIA API key** — https://build.nvidia.com

No local Docker is required: `deploy.sh` builds the image in the cloud with
`az acr build`.

## Quick start (recommended — `deploy.sh`)

```bash
cp azure/.env.azure.example azure/.env.azure
# Fill in PG_ADMIN_PASSWORD, SESSION_SECRET, GOOGLE_CLIENT_ID/SECRET, NVIDIA_API_KEY.
#   openssl rand -hex 32       # SESSION_SECRET
#   openssl rand -base64 24    # PG_ADMIN_PASSWORD

./azure/deploy.sh
```

The script prints the app URL and the exact Google **redirect URI** to add:

```
https://<app>.<region>.azurecontainerapps.io/auth/google/callback
```

Add it to your OAuth client, wait a minute, and sign-in works. Re-run
`./azure/deploy.sh` any time to redeploy after code changes.

## Alternative — Bicep

```bash
az group create -n synthboard-rg -l eastus
az acr create -g synthboard-rg -n <acrName> --sku Basic --admin-enabled true
az acr build -r <acrName> -f Dockerfile.azure -t synthboard:latest .

az deployment group create -g synthboard-rg -f azure/main.bicep \
  -p acrName=<acrName> \
     pgAdminPassword='<pw>' sessionSecret='<secret>' \
     googleClientId='<id>' googleClientSecret='<secret>' nvidiaApiKey='<key>'
```

Read the `appUrlToSet` output, add `${appUrlToSet}/auth/google/callback` to your
OAuth client, then redeploy passing `appUrl=<that value>` so OAuth callbacks and
secure cookies resolve to the real host.

## Configuration

Secrets are stored as **Container App secrets** and injected as env vars; the
rest are plain env vars. See [`.env.azure.example`](./.env.azure.example) for the
full list. The runtime app config (`DATABASE_URL`, `SESSION_SECRET`, OAuth, LLM,
quota) is identical to the root [`.env.example`](../.env.example).

## Operating

```bash
# Tail logs
az containerapp logs show -g synthboard-rg -n synthboard --follow

# Update one env var without redeploying the image
az containerapp update -g synthboard-rg -n synthboard --set-env-vars KEY=value

# Connect to the database with psql (TLS required)
psql "host=<server>.postgres.database.azure.com port=5432 dbname=synthboard \
      user=synthadmin password=<pw> sslmode=require"
```

## Continuous deployment (GitHub Actions)

[`.github/workflows/azure-deploy.yml`](../.github/workflows/azure-deploy.yml)
rebuilds the image in ACR and rolls it out to the Container App on every push to
`main` (and on manual dispatch). It handles **deployment only** — run
`azure/deploy.sh` once first to create the infrastructure.

One-time setup. Create a service principal scoped to the resource group:

```bash
SUB_ID=$(az account show --query id -o tsv)
az ad sp create-for-rbac --name synthboard-cicd --role contributor \
  --scopes /subscriptions/$SUB_ID/resourceGroups/synthboard-rg --sdk-auth
```

Then in the repo under **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `AZURE_CREDENTIALS` | the full JSON printed above |
| Variable | `AZURE_RESOURCE_GROUP` | e.g. `synthboard-rg` |
| Variable | `AZURE_ACR_NAME` | registry name only, e.g. `synthboardacr1234` |
| Variable | `AZURE_CONTAINERAPP_NAME` | e.g. `synthboard` |

Each run tags the image with the commit SHA (and `latest`) and updates the app
to that exact SHA, so rollbacks are just `az containerapp update --image
<acr>/synthboard:<old-sha>`. For a keyless setup, swap the service-principal
secret for OIDC federated credentials and drop `creds` from the `azure/login`
step.

## Notes & production hardening

- **Networking:** the Postgres firewall is opened to *Azure services* for
  simplicity. For production, put the Container App and Postgres on a VNet and
  use a Private DNS zone instead of the open rule.
- **Scaling:** the app pins `minReplicas: 1, maxReplicas: 1`. SynthBoard stores
  sessions in Postgres, so it scales horizontally fine — raise `maxReplicas` if
  you expect load. Keep `minReplicas: 1` to avoid cold starts on the OAuth flow.
- **Long LLM calls:** generation can take minutes. `LLM_TIMEOUT_MS` (280s) sits
  just under Node's 300s request timeout. If you front the app with a different
  proxy, keep its read timeout ≥ 300s.
- **Custom domain:** add it in Container Apps, set `APP_URL` to that domain, and
  add `${APP_URL}/auth/google/callback` to the OAuth client.

## Teardown

```bash
az group delete -n synthboard-rg --yes --no-wait
```
