# Azure Deployment Plan

> **Status:** Ready for Validation

Generated: 2026-07-15

---

## 1. Project Overview

**Goal:** Expose the existing Azure Container App secret `anthropic-api-key` to the application as `ANTHROPIC_API_KEY` during scripted deployments.

**Path:** Modify existing Azure deployment configuration.

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | Existing SynthBoard deployment; unchanged |
| Scale | Unchanged |
| Budget | No cost-impacting resource changes |
| Subscription | Not required; no live Azure operation is planned |
| Location | Not required; no live Azure operation is planned |
| Compliance | Do not read, create, rotate, or commit the secret value |

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| Application | SPA + API | React + Node.js/Express | `client/`, `server/` |
| Runtime | Container | Docker | `Dockerfile.azure` |
| Deployment script | Azure CLI | Bash | `azure/deploy.sh` |
| Declarative alternative | Infrastructure as code | Bicep | `azure/main.bicep` |
| Continuous deployment | Image rollout | GitHub Actions + Azure CLI | `.github/workflows/azure-deploy.yml` |

## 4. Recipe Selection

**Selected:** Existing Azure CLI recipe.

**Rationale:** `azure/deploy.sh` owns the Container App environment-variable mappings. The Bicep file is a separate full-provisioning alternative, while the GitHub Actions workflow only updates the image.

## 5. Architecture

**Stack:** Existing Azure Container Apps deployment; no architecture changes.

The requested mapping will be added to the `ENVVARS` array in `azure/deploy.sh`:

`ANTHROPIC_API_KEY=secretref:anthropic-api-key`

The secret will not be added to the script's `SECRETS` array because the request identifies it as an existing Azure Container App secret.

## 6. Provisioning Limit Checklist

No resources will be provisioned or scaled. Subscription quotas and capacity checks are not applicable.

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| None | 0 | Unchanged | Not applicable | Configuration-only change; no deployment authorized |

**Status:** No provisioning impact.

## Research Summary

- Azure Container Apps accepts an existing secret as an environment-variable source using `NAME=secretref:SECRET_NAME`.
- `az containerapp update --set-env-vars` adds or updates named variables without replacing unrelated environment variables.
- Sensitive values must remain outside source control; this change stores only the secret name and never handles the value.
- Updating Container App environment variables creates a new revision when the deployment script is next run.

## 7. Execution Checklist

### Planning

- [x] Analyze workspace
- [x] Scan existing Azure configuration
- [x] Select the existing Azure CLI recipe
- [x] Confirm there is no provisioning or architecture change
- [x] User approved this plan

### Execution

- [x] Add the requested secret reference to `azure/deploy.sh`
- [x] Validate Bash syntax
- [x] Confirm the diff is focused and contains no secret value
- [ ] Commit and push the change to `main`

## Functional Verification

- Status: Not applicable to this configuration-only change
- Backend: No application code changed
- UI: No application code changed
- Notes: `bash -n azure/deploy.sh` and `git diff --check` passed; `shellcheck` is not installed in the workspace

## Role Assignment Verification

- Status: Not applicable
- Identities checked: None; this change does not add or modify an identity
- Roles confirmed: No static role assignments are present in the scoped Azure scripts
- Issues: None related to the requested secret reference

## Validation Proof

| Check | Command | Result | Date |
|-------|---------|--------|------|
| Bash syntax | `bash -n azure/deploy.sh` | Pass | 2026-07-15 |
| Patch formatting | `git diff --check` | Pass | 2026-07-15 |
| Secret reference | Exact-match check for `ANTHROPIC_API_KEY=secretref:anthropic-api-key` | Pass | 2026-07-15 |
| Bicep compilation | `az bicep build --file azure/main.bicep --stdout` | Not run: Azure CLI is not installed; Bicep was not modified | 2026-07-15 |

Live template validation, what-if, policy checks, and deployment are outside the authorized scope of this configuration-only request.

## 8. Files

| File | Purpose | Planned action |
|------|---------|----------------|
| `.azure/deployment-plan.md` | Required preparation record | Add |
| `azure/deploy.sh` | Container App environment mapping | Modify |

## 9. Deployment

No live Azure deployment is authorized or planned. The repository change will be published to `main` after validation.
