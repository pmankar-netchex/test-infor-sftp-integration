# Azure Deployment Guide

This document outlines the step-by-step process for deploying the SFTP integration application to Azure.

## Prerequisites

- An Azure subscription
- Azure CLI installed and configured
- Node.js 20.x LTS
- Git (for version control)

## Deployment Options

### Option 1: Automated Deployment Script

The easiest way to deploy is to use the included script that automates the entire process.

1. **Prepare your Azure account**

   Make sure you're logged in to the Azure CLI:

   ```bash
   az login
   ```

2. **Configure deployment settings (optional)**

   Open `deploy-to-azure.sh` and review/modify the configuration settings:

   - `RESOURCE_GROUP_NAME`: Name of the Azure resource group
   - `LOCATION`: Azure region for deployment
   - `ENVIRONMENT_NAME`: Environment name (prod, dev, etc.)

3. **Run the deployment script**

   ```bash
   ./deploy-to-azure.sh
   ```

   The script will:
   - Create a resource group if it doesn't exist
   - Deploy the Bicep infrastructure
   - Build and deploy the Node.js application
   - Configure all necessary settings

4. **Verify deployment**

   Once completed, the script will output the URL of your deployed application.

### Option 2: Manual Deployment

If you prefer to deploy manually or need more control over the process:

1. **Create Azure resources**

   a. Create a resource group:
   ```bash
   az group create --name sftp-integration-rg --location eastus
   ```

   b. Deploy the Bicep template:
   ```bash
   az deployment group create \
     --name sftp-deployment \
     --resource-group sftp-integration-rg \
     --template-file ./src/infra/parameters.bicep \
     --parameters environmentName=prod location=eastus
   ```

   ```

3. **Deploy the Node.js application**

   a. Build the application:
   ```bash
   npm ci --production
   ```

   b. Create a deployment package:
   ```bash
   zip -r ./app.zip . -x "node_modules/*" ".git/*" "logs/*" ".env"
   ```

   c. Deploy to Azure App Service:
   ```bash
   az webapp deployment source config-zip \
     --resource-group sftp-integration-rg \
     --name <your-app-service-name> \
     --src ./app.zip
   ```

4. **Configure application settings**

   a. Set the environment variables:
   ```bash
   az webapp config appsettings set \
     --resource-group sftp-integration-rg \
     --name <your-app-service-name> \
     --settings \
       NODE_ENV=production \
       SQL_SERVER=<your-sql-server>.database.windows.net \
       SQL_DATABASE=employeedata \
       KEY_VAULT_NAME=<your-key-vault-name> \
       STORAGE_ACCOUNT_NAME=<your-storage-account> \
       FILE_SHARE_NAME=sftpshare \
       SCHEDULE_INTERVAL="*/15 * * * *"
   ```

## Post-Deployment Steps

1. **Verify deployment**

   Visit the App Service URL and check the `/health` endpoint to confirm the application is running.

2. **Configure Monitoring**

   Set up alerts in Azure Application Insights for any critical operations.

3. **Security review**

   - Check that Managed Identity is properly configured
   - Verify Azure Key Vault access policies
   - Ensure HTTPS is enforced

## Troubleshooting

If you encounter issues:

1. **Check application logs**
   - Navigate to the App Service in Azure Portal
   - Go to "Monitoring" > "Log stream"
   - Check for errors in the application logs

2. **Verify configurations**
   - Ensure all App Service configuration settings are correct
   - Check that Azure resources are provisioned correctly

3. **Common issues**
   - **Connection errors**: Verify that the firewall allows connections
   - **Authentication issues**: Check Managed Identity configuration
   - **Missing data**: Verify SQL schema and data access permissions
