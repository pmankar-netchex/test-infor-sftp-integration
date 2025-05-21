# Azure SFTP Integration

A Node.js application designed to run on Azure App Service that fetches company data, processes employee information, and generates structured JSON files that are uploaded to Azure File Share (SFTP).

## Project Overview

This application performs the following tasks:

1. Queries SQL Server to fetch a list of company IDs
2. Gets detailed company information for each ID from the database
3. Retrieves employee information for each company
4. Transforms the data into a specific JSON format (as per requirements)
5. Uploads the JSON files to Azure File Share with a specific naming convention
6. Runs on a schedule (every 15 minutes)

## Architecture

![Azure Architecture](https://via.placeholder.com/800x400?text=Azure+Architecture+Diagram)

The application uses the following Azure services:

## Deployment

### GitHub Deployment to Azure App Service

This application is configured for automatic deployment from GitHub to Azure App Service using GitHub Actions.

#### Prerequisites

1. An Azure subscription
2. GitHub account
3. Azure CLI installed locally
4. GitHub CLI installed locally

#### Setup and Deployment Steps

1. Run the setup script to create a GitHub repository and Azure resources:

```bash
# Make the script executable (if needed)
chmod +x setup-github-and-azure.sh

# Run the script
./setup-github-and-azure.sh
```

2. Add the required GitHub secrets:

```bash
# Replace YOUR_WEBAPP_NAME with your actual App Service name
gh secret set AZURE_WEBAPP_NAME --body "YOUR_WEBAPP_NAME"

# Set the publish profile (run this in the directory containing publish_profile.xml)
gh secret set AZURE_WEBAPP_PUBLISH_PROFILE --body "$(cat publish_profile.xml)"
```

3. Push changes to GitHub to trigger deployment:

```bash
git add .
git commit -m "Update application files"
git push origin main
```

4. Monitor the deployment in the GitHub Actions tab.

5. Access your application at: `https://YOUR_WEBAPP_NAME.azurewebsites.net`

### Manual Deployment

For manual deployment, use the included deployment script:

```bash
# Make the script executable (if needed)
chmod +x deploy-to-azure.sh

# Run the script
./deploy-to-azure.sh
```

## Configuration

- **Azure App Service**: Hosts the Node.js application
- **Azure SQL Database**: Stores employee data
- **Azure Storage Account (File Share)**: Acts as SFTP destination for JSON files
- **Azure Key Vault**: Securely stores credentials and secrets
- **Azure Application Insights**: Provides monitoring and logging

## Directory Structure

```
azure-sftp-integration/
├── src/
│   ├── services/         # Service modules
│   ├── utils/            # Utility functions (including configService)
│   └── infra/            # Infrastructure as Code (Bicep)
├── logs/                 # Application logs
├── .env                  # Environment variables (local development)
├── .env.example          # Example environment variables template
├── Dockerfile            # Container definition
├── deploy-to-azure.sh    # Deployment script
├── index.js              # Application entry point
└── package.json          # Project dependencies
```

## Prerequisites

- Node.js 20.x or later
- Azure subscription
- Azure CLI installed and configured
- SQL Server with employee data

## Local Development

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with the required environment variables (see `.env.example`)

4. Run the application in development mode:

```bash
npm run dev
```

The server will start on port 3000 with nodemon for auto-reloading on changes.

## Deployment to Azure

### Option 1: Use the Deployment Script

1. Make sure you have Azure CLI installed and logged in:

```bash
az login
```

2. Run the deployment script:

```bash
./deploy-to-azure.sh
```

3. Follow the prompts to confirm deployment steps.

### Option 2: Deploy with Enhanced Monitoring

For deployments with Application Insights monitoring:

```bash
./deploy-with-monitoring.sh
```

This script will:
- Create all required resources including Application Insights
- Configure the application to send telemetry data
- Deploy the application with monitoring enabled

### Option 3: Manual Deployment

1. Create Azure resources using the Bicep templates:

```bash
az group create --name sftp-integration-rg --location eastus
az deployment group create --resource-group sftp-integration-rg --template-file ./src/infra/parameters.bicep
```

2. Build and deploy the Node.js application:

```bash
npm ci --production
zip -r ./app.zip . -x "node_modules/*" ".git/*" "logs/*" ".env"
az webapp deployment source config-zip --resource-group sftp-integration-rg --name <app-name> --src ./app.zip
```

## File Naming Convention

The generated JSON files follow this naming pattern:

```
xxxxInforEmpDatammddyyyyhhmmss.json
```

Where:
- `xxxx` = 4-digit store number (from company data)
- `mmddyyyy` = month, day, year
- `hhmmss` = hour, minute, second

## JSON Format

The JSON output follows this structure:

```json
{
  "Report_Entry": [
    {
      "UserID": "200054572",
      "Status": "Active",
      "Email": "MaryManager@outlook.com",
      "FirstName": "Mary",
      "LastName": "Manager",
      "Positions": [
        {
          "PayRate": "4.25",
          "JobCode": "CHOP",
          "PrimaryJob": 1
        },
        {
          "PayRate": "8.25",
          "JobCode": "CREW",
          "PrimaryJob": 0
        }
      ],
      "HireDate": "2020-08-28",
      "TermDate": "2020-08-28",
      "PhoneNumber": "+1 (555) 4121212",
      "DateofBirth": "1983-06-08",
      "SSN": "123456789"
    }
  ]
}
```

## Configuration

The application uses a simplified configuration approach based on environment variables loaded from `.env` file. Configuration is managed by the centralized `configService` module.

### Environment Variables

All configuration is controlled through the `.env` file (for local development) or App Service Configuration settings (for production). Here's a list of required environment variables:

```
# Environment (development, production, test)
NODE_ENV=development

# SQL Server Configuration
SQL_SERVER=your-sql-server
SQL_DATABASE=your-database
SQL_USER=your-username     # Used in development only
SQL_PASSWORD=your-password # Used in development only

# Azure Key Vault
KEY_VAULT_NAME=your-key-vault

# Azure File Share (SFTP) Configuration
STORAGE_ACCOUNT_NAME=your-storage-account
FILE_SHARE_NAME=your-file-share
STORAGE_ACCOUNT_KEY=your-storage-key   # Used in development only

# Schedule Configuration (cron format)
SCHEDULE_INTERVAL="*/15 * * * *"

# Application Insights (for production)
APPINSIGHTS_INSTRUMENTATIONKEY=your-key-here

# Logging Configuration
LOG_LEVEL=info
```

### Environment-Specific Configuration

The application automatically uses different configuration settings based on the `NODE_ENV` environment variable:

- **Production mode**: Uses Azure Managed Identity for authentication to Azure services
- **Development mode**: Uses username/password for SQL and account keys for Azure Storage
- **Test mode**: Uses mock services for testing

### Usage in Code

To access configuration values in the code:

```javascript
const configService = require('./src/utils/configService');

// Get a configuration value
const dbServer = configService.get('database.server');

// Get a value with a default fallback
const logLevel = configService.get('logging.level', 'info');

// Check the environment
if (configService.isProduction()) {
  // Production-specific code
}
```

## Security Considerations

- In production, the application uses Managed Identity for Azure services authentication
- SQL credentials are stored in Azure Key Vault
- All connections use TLS 1.2 or higher
- No sensitive data is logged

## Monitoring

The application uses Azure Application Insights for comprehensive monitoring and telemetry. Key features include:

- Real-time tracking of file processing jobs
- Performance metrics for API calls and database operations
- Custom events for business process tracking
- Exception monitoring and alerting
- Custom dashboards for operational visibility

For more information, see the [Application Insights Integration](./docs/ApplicationInsights.md) document.

## Testing

### Running Tests

This project uses Jest for unit testing. Run the full test suite with:

```bash
npm test
```

Or with coverage:

```bash
npm run test:coverage
```

### Testing Database Connectivity

To test the database connection using values from your `.env` file:

```bash
# Run the database test script
./scripts/run-db-test.sh
```

This script will:
- Verify the `.env` file exists and contains the necessary database configuration
- Attempt to connect to the database using these settings
- Display detailed information about the connection attempt and any errors

For more details on database connectivity testing and troubleshooting, see:
- [Database Connectivity Guide](./docs/DatabaseConnectivity.md)
- [Database Troubleshooting Guide](./docs/DatabaseTroubleshooting.md)

## Deployment

### Option 1: Use the Deployment Script

1. Make sure you have Azure CLI installed and logged in:

```bash
az login
```

2. Run the deployment script:

```bash
./deploy-to-azure.sh
```

3. Follow the prompts to confirm deployment steps.

### Option 2: Deploy with Enhanced Monitoring

For deployments with Application Insights monitoring:

```bash
./deploy-with-monitoring.sh
```

This script will:
- Create all required resources including Application Insights
- Configure the application to send telemetry data
- Deploy the application with monitoring enabled

### Option 3: Manual Deployment

1. Create Azure resources using the Bicep templates:

```bash
az group create --name sftp-integration-rg --location eastus
az deployment group create --resource-group sftp-integration-rg --template-file ./src/infra/parameters.bicep
```

2. Build and deploy the Node.js application:

```bash
npm ci --production
zip -r ./app.zip . -x "node_modules/*" ".git/*" "logs/*" ".env"
az webapp deployment source config-zip --resource-group sftp-integration-rg --name <app-name> --src ./app.zip
```

## File Naming Convention

The generated JSON files follow this naming pattern:

```
xxxxInforEmpDatammddyyyyhhmmss.json
```

Where:
- `xxxx` = 4-digit store number (from company data)
- `mmddyyyy` = month, day, year
- `hhmmss` = hour, minute, second

## JSON Format

The JSON output follows this structure:

```json
{
  "Report_Entry": [
    {
      "UserID": "200054572",
      "Status": "Active",
      "Email": "MaryManager@outlook.com",
      "FirstName": "Mary",
      "LastName": "Manager",
      "Positions": [
        {
          "PayRate": "4.25",
          "JobCode": "CHOP",
          "PrimaryJob": 1
        },
        {
          "PayRate": "8.25",
          "JobCode": "CREW",
          "PrimaryJob": 0
        }
      ],
      "HireDate": "2020-08-28",
      "TermDate": "2020-08-28",
      "PhoneNumber": "+1 (555) 4121212",
      "DateofBirth": "1983-06-08",
      "SSN": "123456789"
    }
  ]
}
```

## Configuration

The application uses a simplified configuration approach based on environment variables loaded from `.env` file. Configuration is managed by the centralized `configService` module.

### Environment Variables

All configuration is controlled through the `.env` file (for local development) or App Service Configuration settings (for production). Here's a list of required environment variables:

```
# Environment (development, production, test)
NODE_ENV=development

# SQL Server Configuration
SQL_SERVER=your-sql-server
SQL_DATABASE=your-database
SQL_USER=your-username     # Used in development only
SQL_PASSWORD=your-password # Used in development only

# Azure Key Vault
KEY_VAULT_NAME=your-key-vault

# Azure File Share (SFTP) Configuration
STORAGE_ACCOUNT_NAME=your-storage-account
FILE_SHARE_NAME=your-file-share
STORAGE_ACCOUNT_KEY=your-storage-key   # Used in development only

# Schedule Configuration (cron format)
SCHEDULE_INTERVAL="*/15 * * * *"

# Application Insights (for production)
APPINSIGHTS_INSTRUMENTATIONKEY=your-key-here

# Logging Configuration
LOG_LEVEL=info
```

### Environment-Specific Configuration

The application automatically uses different configuration settings based on the `NODE_ENV` environment variable:

- **Production mode**: Uses Azure Managed Identity for authentication to Azure services
- **Development mode**: Uses username/password for SQL and account keys for Azure Storage
- **Test mode**: Uses mock services for testing

### Usage in Code

To access configuration values in the code:

```javascript
const configService = require('./src/utils/configService');

// Get a configuration value
const dbServer = configService.get('database.server');

// Get a value with a default fallback
const logLevel = configService.get('logging.level', 'info');

// Check the environment
if (configService.isProduction()) {
  // Production-specific code
}
```

## Security Considerations

- In production, the application uses Managed Identity for Azure services authentication
- SQL credentials are stored in Azure Key Vault
- All connections use TLS 1.2 or higher
- No sensitive data is logged

## Monitoring

The application uses Azure Application Insights for comprehensive monitoring and telemetry. Key features include:

- Real-time tracking of file processing jobs
- Performance metrics for API calls and database operations
- Custom events for business process tracking
- Exception monitoring and alerting
- Custom dashboards for operational visibility

For more information, see the [Application Insights Integration](./docs/ApplicationInsights.md) document.

## Testing

### Running Tests

This project uses Jest for unit testing. Run the full test suite with:

```bash
npm test
```

Or with coverage:

```bash
npm run test:coverage
```

### Testing Database Connectivity

To test the database connection using values from your `.env` file:

```bash
# Run the database test script
./scripts/run-db-test.sh
```

This script will:
- Verify the `.env` file exists and contains the necessary database configuration
- Attempt to connect to the database using these settings
- Display detailed information about the connection attempt and any errors

For more details on database connectivity testing and troubleshooting, see:
- [Database Connectivity Guide](./docs/DatabaseConnectivity.md)
- [Database Troubleshooting Guide](./docs/DatabaseTroubleshooting.md)

## License

ISC
