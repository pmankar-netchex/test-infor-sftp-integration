#!/bin/bash

# Azure deployment script for SFTP Integration Application
set -e

# Configuration
RESOURCE_GROUP_NAME="sftp-integration-rg"
LOCATION="eastus"
ENVIRONMENT_NAME="prod"
SQL_ADMIN_PASSWORD="P@ssw0rd1234!" # In production, use a secure method to get this

# Print ASCII art header
echo "================================================================================"
echo "              Azure SFTP Integration - Deployment Script"
echo "================================================================================"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Azure CLI is not installed. Please install it first."
    echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if user is logged in to Azure
echo "Checking Azure login status..."
az account show &> /dev/null || {
    echo "You are not logged in to Azure. Please run 'az login' first."
    exit 1
}

# Show current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "Using subscription: $SUBSCRIPTION ($SUBSCRIPTION_ID)"
echo ""

# Confirm with the user
read -p "Do you want to deploy to this subscription? (y/n): " CONFIRM
if [[ $CONFIRM != "y" && $CONFIRM != "Y" ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Create resource group if it doesn't exist
echo "Creating resource group $RESOURCE_GROUP_NAME in $LOCATION if it doesn't exist..."
az group create --name $RESOURCE_GROUP_NAME --location $LOCATION

# Deploy Bicep template with parameters
echo "Deploying infrastructure with Bicep..."
DEPLOYMENT_NAME="sftp-integration-deployment-$(date +%Y%m%d%H%M%S)"

# First run a what-if deployment to preview changes
echo "Previewing deployment changes..."
az deployment group what-if \
    --name $DEPLOYMENT_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --template-file ./src/infra/parameters.bicep \
    --parameters environmentName=$ENVIRONMENT_NAME location=$LOCATION

# Confirm deployment
read -p "Do you want to proceed with the deployment? (y/n): " CONFIRM
if [[ $CONFIRM != "y" && $CONFIRM != "Y" ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Execute the actual deployment
echo "Executing deployment..."
DEPLOYMENT_OUTPUT=$(az deployment group create \
    --name $DEPLOYMENT_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --template-file ./src/infra/parameters.bicep \
    --parameters environmentName=$ENVIRONMENT_NAME location=$LOCATION \
    --output json)

# Extract outputs
APP_SERVICE_NAME=$(echo $DEPLOYMENT_OUTPUT | jq -r '.properties.outputs.appServiceUrl.value' | sed 's|https://||' | sed 's|.azurewebsites.net||')
APP_SERVICE_URL=$(echo $DEPLOYMENT_OUTPUT | jq -r '.properties.outputs.appServiceUrl.value')
SQL_SERVER_FQDN=$(echo $DEPLOYMENT_OUTPUT | jq -r '.properties.outputs.sqlServerFqdn.value')
KEY_VAULT_URL=$(echo $DEPLOYMENT_OUTPUT | jq -r '.properties.outputs.keyVaultUrl.value')

echo "Infrastructure deployment completed successfully!"
echo ""
echo "Resource Summary:"
echo "- App Service URL: $APP_SERVICE_URL"
echo "- SQL Server FQDN: $SQL_SERVER_FQDN"
echo "- Key Vault URL: $KEY_VAULT_URL"
echo ""

# Build and deploy the Node.js application
echo "Building and deploying the Node.js application..."

# Prepare the application for deployment
echo "Building application..."
npm ci --production

# Use Azure App Service ZIP Deploy
echo "Creating deployment package..."
mkdir -p deployment
zip -r ./deployment/app.zip . -x "node_modules/*" "deployment/*" "logs/*" ".git/*" ".env"

# Deploy the zip package to App Service
echo "Deploying application to Azure App Service..."
az webapp deployment source config-zip \
    --resource-group $RESOURCE_GROUP_NAME \
    --name $APP_SERVICE_NAME \
    --src ./deployment/app.zip

# Set environment variables from .env.example to App Service Configuration
echo "Setting environment variables in App Service Configuration..."
if [ -f .env.example ]; then
    # Read from .env.example and set each variable in App Service
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        if [[ $line =~ ^[^#].+=.+ ]]; then
            # Extract key and value
            key=$(echo "$line" | cut -d '=' -f 1)
            value=$(echo "$line" | cut -d '=' -f 2-)
            
            # Skip if the value contains "your-" placeholder
            if [[ ! $value =~ "your-" ]]; then
                echo "Setting $key in App Service Configuration..."
                az webapp config appsettings set \
                    --resource-group $RESOURCE_GROUP_NAME \
                    --name $APP_SERVICE_NAME \
                    --settings "$key=$value" \
                    --output none
            fi
        fi
    done < .env.example
fi

# Add script to create .env file from environment variables on App Service startup
echo "Configuring App Service to create .env file on startup..."
az webapp config set \
    --resource-group $RESOURCE_GROUP_NAME \
    --name $APP_SERVICE_NAME \
    --post-deployment-script-path="./scripts/setup-env.js" \
    --output none

echo "Application deployment completed successfully!"
echo "You can access your application at: $APP_SERVICE_URL"
echo ""

# Clean up
rm -rf ./deployment

echo "Deployment process completed."
