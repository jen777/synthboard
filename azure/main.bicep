// ─────────────────────────────────────────────────────────────
// SynthBoard — declarative Azure infrastructure (alternative to deploy.sh).
//
// Provisions a Container Registry, a PostgreSQL Flexible Server, a Container
// Apps environment, and a single-container Container App.
//
// Because Bicep can't build a Docker image, push it first, then deploy:
//
//   az group create -n synthboard-rg -l eastus
//   az acr create -g synthboard-rg -n <acrName> --sku Basic --admin-enabled true
//   az acr build -r <acrName> -f Dockerfile.azure -t synthboard:latest .
//   az deployment group create -g synthboard-rg -f azure/main.bicep \
//     -p acrName=<acrName> pgAdminPassword=<pw> sessionSecret=<secret> \
//        googleClientId=<id> googleClientSecret=<secret> nvidiaApiKey=<key>
//
// After the first deploy, set APP_URL to the app's FQDN (printed as an output)
// and add ${APP_URL}/auth/google/callback to your Google OAuth client, then
// redeploy with appUrl=<that value>.
// ─────────────────────────────────────────────────────────────

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Name prefix for resources.')
param namePrefix string = 'synthboard'

@description('Existing Container Registry name (image must already be pushed to it).')
param acrName string

@description('Container image repository:tag within the registry.')
param containerImage string = 'synthboard:latest'

@description('PostgreSQL admin username.')
param pgAdminUser string = 'synthadmin'

@secure()
@description('PostgreSQL admin password.')
param pgAdminPassword string

@description('PostgreSQL database name.')
param pgDatabaseName string = 'synthboard'

@description('Public app URL. Leave blank on first deploy; set to the FQDN output afterwards.')
param appUrl string = ''

@secure()
param sessionSecret string
@secure()
param googleClientId string
@secure()
param googleClientSecret string
@secure()
param nvidiaApiKey string

param llmBaseUrl string = 'https://integrate.api.nvidia.com/v1'
param llmModel string = 'minimaxai/minimax-m2.7'
param maxVisualizationsPerAccount string = '5'
param adminEmails string = ''

var pgServerName = '${namePrefix}-pg-${uniqueString(resourceGroup().id)}'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

// ── PostgreSQL Flexible Server ────────────────────────────────
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: pgServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: pgAdminUser
    administratorLoginPassword: pgAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }

  resource database 'databases' = {
    name: pgDatabaseName
  }

  // Allow other Azure services (incl. Container Apps) to connect. For production,
  // prefer VNet integration + Private DNS over this open-to-Azure rule.
  resource allowAzure 'firewallRules' = {
    name: 'AllowAzureServices'
    properties: {
      startIpAddress: '0.0.0.0'
      endIpAddress: '0.0.0.0'
    }
  }
}

// ── Container Apps environment ────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${namePrefix}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource caeEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

var databaseUrl = 'postgres://${pgAdminUser}:${pgAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${pgDatabaseName}'

// ── Container App (single container: SPA + API) ───────────────
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: namePrefix
  location: location
  properties: {
    managedEnvironmentId: caeEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password', value: acr.listCredentials().passwords[0].value }
        { name: 'database-url', value: databaseUrl }
        { name: 'session-secret', value: sessionSecret }
        { name: 'google-client-id', value: googleClientId }
        { name: 'google-client-secret', value: googleClientSecret }
        { name: 'nvidia-api-key', value: nvidiaApiKey }
      ]
    }
    template: {
      containers: [
        {
          name: namePrefix
          image: '${acr.properties.loginServer}/${containerImage}'
          resources: {
            cpu: json('0.5')
            memory: '1.0Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'SERVE_STATIC', value: 'true' }
            { name: 'DATABASE_SSL', value: 'true' }
            { name: 'APP_URL', value: appUrl }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'SESSION_SECRET', secretRef: 'session-secret' }
            { name: 'GOOGLE_CLIENT_ID', secretRef: 'google-client-id' }
            { name: 'GOOGLE_CLIENT_SECRET', secretRef: 'google-client-secret' }
            { name: 'NVIDIA_API_KEY', secretRef: 'nvidia-api-key' }
            { name: 'LLM_BASE_URL', value: llmBaseUrl }
            { name: 'LLM_MODEL', value: llmModel }
            { name: 'MAX_VISUALIZATIONS_PER_ACCOUNT', value: maxVisualizationsPerAccount }
            { name: 'ADMIN_EMAILS', value: adminEmails }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

output appFqdn string = app.properties.configuration.ingress.fqdn
output appUrlToSet string = 'https://${app.properties.configuration.ingress.fqdn}'
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
