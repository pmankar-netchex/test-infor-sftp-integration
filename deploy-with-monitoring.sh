#!/bin/bash
# Script to deploy the Azure SFTP Integration application to Azure
# This script sets up Application Insights for monitoring

echo "Starting deployment of Azure SFTP Integration..."

# Set variables
RESOURCE_GROUP="azure-sftp-integration-rg"
LOCATION="eastus"
APP_SERVICE_PLAN="sftp-integration-asp"
APP_SERVICE="sftp-integration-app"
STORAGE_ACCOUNT="sftpintegrationsa"
FILE_SHARE="sftpshare"
SQL_SERVER="sftp-integration-sql"
SQL_DB="employeedata"
KEY_VAULT="sftp-integration-kv"
APP_INSIGHTS="sftp-integration-insights"

# Create resource group if it doesn't exist
echo "Creating resource group $RESOURCE_GROUP if it doesn't exist..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Deploy Bicep template
echo "Deploying infrastructure with Bicep..."
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file ./src/infra/main.bicep \
  --parameters \
    appServiceName=$APP_SERVICE \
    appServicePlanName=$APP_SERVICE_PLAN \
    sqlServerName=$SQL_SERVER \
    sqlDatabaseName=$SQL_DB \
    storageAccountName=$STORAGE_ACCOUNT \
    fileShareName=$FILE_SHARE \
    keyVaultName=$KEY_VAULT \
    appInsightsName=$APP_INSIGHTS

# Get the Application Insights instrumentation key
echo "Retrieving Application Insights instrumentation key..."
INSTRUMENTATION_KEY=$(az resource show --resource-group $RESOURCE_GROUP --name $APP_INSIGHTS --resource-type "microsoft.insights/components" --query properties.InstrumentationKey -o tsv)

# Update App Service settings
echo "Configuring App Service settings..."
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE \
  --settings \
    APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY \
    NODE_ENV=production \
    SQL_SERVER=$SQL_SERVER.database.windows.net \
    SQL_DATABASE=$SQL_DB \
    STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT \
    FILE_SHARE_NAME=$FILE_SHARE \
    KEY_VAULT_NAME=$KEY_VAULT \
    SCHEDULE_INTERVAL="0 0/1 * * * *" # Run every hour

# Deploy the app using zip deployment
echo "Building and deploying application..."
npm install
npm run build
zip -r app.zip . -x "node_modules/*" ".git/*"

az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE \
  --src app.zip

# Clean up
rm app.zip

echo "Deployment complete! Your application is now running at https://$APP_SERVICE.azurewebsites.net"
echo "View monitoring data in the Azure Portal under Application Insights: $APP_INSIGHTS"
