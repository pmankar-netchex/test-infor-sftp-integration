@description('The environment name')
param environmentName string = 'prod'

@description('The Azure region for deployment')
param location string = resourceGroup().location

// Generate unique names with environment prefix
var appServiceName = 'sftp-integration-${environmentName}-${uniqueString(resourceGroup().id)}'
var appServicePlanName = 'sftp-asp-${environmentName}-${uniqueString(resourceGroup().id)}'
var sqlServerName = 'sftp-sql-${environmentName}-${uniqueString(resourceGroup().id)}'
var sqlDatabaseName = 'employeedb'
var storageAccountName = replace('sftpstore${environmentName}${uniqueString(resourceGroup().id)}', '-', '')
var fileShareName = 'sftpshare'
var keyVaultName = 'sftp-kv-${environmentName}-${uniqueString(resourceGroup().id)}'
var appInsightsName = 'sftp-ai-${environmentName}-${uniqueString(resourceGroup().id)}'

// Define App Service Plan SKU based on environment
var appServicePlanSku = environmentName == 'prod' ? {
  name: 'P1v2'
  tier: 'PremiumV2'
  size: 'P1v2'
  family: 'Pv2'
  capacity: 1
} : {
  name: 'B1'
  tier: 'Basic'
  size: 'B1'
  family: 'B'
  capacity: 1
}

// Deploy the main infrastructure
module infrastructure 'main.bicep' = {
  name: 'infrastructure-deployment'
  params: {
    appServiceName: appServiceName
    location: location
    appServicePlanName: appServicePlanName
    appServicePlanSku: appServicePlanSku
    sqlServerName: sqlServerName
    sqlDatabaseName: sqlDatabaseName
    storageAccountName: storageAccountName
    fileShareName: fileShareName
    keyVaultName: keyVaultName
    appInsightsName: appInsightsName
    tags: {
      environment: environmentName
      application: 'azure-sftp-integration'
    }
  }
}

// Outputs
output appServiceUrl string = infrastructure.outputs.appServiceUrl
output sqlServerFqdn string = infrastructure.outputs.sqlServerFqdn
output keyVaultUrl string = infrastructure.outputs.keyVaultUrl
