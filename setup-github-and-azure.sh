#!/bin/bash
# Script to create a GitHub repository and set up Azure App Service deployment

# Set variables - Change these as needed
GITHUB_REPO_NAME="test-infor-sftp-integration"
GITHUB_REPO_DESCRIPTION="SFTP Integration Application for Infor POS"
AZURE_RESOURCE_GROUP="testapppranav-rg"
AZURE_RESOURCE_GROUP_LOCATION="westus2"
AZURE_WEBAPP_NAME="testinforsftp-app"
AZURE_LOCATION="westus2"
AZURE_APP_SERVICE_PLAN="testinforsftp-plan"
AZURE_APP_SERVICE_SKU="B1"

# 1. Ensure git is initialized and files are committed
echo "Initializing git repository and making initial commit..."
git init
git add .
git commit -m "Initial commit"

# 2. Create GitHub repository using GitHub CLI (gh)
echo "Creating GitHub repository: $GITHUB_REPO_NAME..."
gh auth status || gh auth login
gh repo create $GITHUB_REPO_NAME --public --source=. --remote=origin --push

# 3. Create Azure resources
echo "Creating Azure resources..."
echo "Creating resource group: $AZURE_RESOURCE_GROUP in $AZURE_LOCATION..."
az group create --name $AZURE_RESOURCE_GROUP --location $AZURE_LOCATION

echo "Creating App Service Plan: $AZURE_APP_SERVICE_PLAN..."
az appservice plan create --name $AZURE_APP_SERVICE_PLAN \
  --resource-group $AZURE_RESOURCE_GROUP \
  --sku $AZURE_APP_SERVICE_SKU \
  --is-linux

echo "Creating Web App: $AZURE_WEBAPP_NAME..."
az webapp create --name $AZURE_WEBAPP_NAME \
  --resource-group $AZURE_RESOURCE_GROUP \
  --plan $AZURE_APP_SERVICE_PLAN \
  --runtime "NODE|20-lts"

# 4. Configure Web App settings
echo "Configuring Web App settings..."
az webapp config appsettings set --name $AZURE_WEBAPP_NAME \
  --resource-group $AZURE_RESOURCE_GROUP \
  --settings \
  NODE_ENV=production \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true \
  WEBSITE_NODE_DEFAULT_VERSION=~20

# 5. Download the publish profile for GitHub Actions
echo "Downloading publish profile for GitHub Actions..."
az webapp deployment list-publishing-profiles \
  --name $AZURE_WEBAPP_NAME \
  --resource-group $AZURE_RESOURCE_GROUP \
  --xml > publish_profile.xml

echo ""
echo "===== NEXT STEPS ====="
echo "1. Add the following secrets to your GitHub repository:"
echo "   AZURE_WEBAPP_NAME: $AZURE_WEBAPP_NAME"
echo "   AZURE_WEBAPP_PUBLISH_PROFILE: Contents of publish_profile.xml file"
echo ""
echo "2. To add secrets to your GitHub repo, run:"
echo "   gh secret set AZURE_WEBAPP_NAME --body \"$AZURE_WEBAPP_NAME\""
echo "   gh secret set AZURE_WEBAPP_PUBLISH_PROFILE --body \"\$(cat publish_profile.xml)\""
echo ""
echo "3. After adding secrets, GitHub Actions will deploy your app on the next push to main branch"
echo "   Or you can manually trigger the workflow from GitHub Actions tab"
echo ""
echo "4. Your app will be available at: https://$AZURE_WEBAPP_NAME.azurewebsites.net"
