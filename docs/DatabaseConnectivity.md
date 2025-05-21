# Database Connection Testing

This guide explains how to properly test your database connection using the values from the `.env` file.

## Prerequisites

1. Make sure you have a properly configured `.env` file in the project root directory with the following database-related variables:

   ```
   # SQL Server Configuration
   SQL_SERVER=your-sql-server
   SQL_DATABASE=your-database
   SQL_USER=your-username
   SQL_PASSWORD=your-password
   
   # Azure Key Vault (if using)
   KEY_VAULT_NAME=your-key-vault
   ```

2. Ensure all dependencies are installed:

   ```bash
   npm install
   ```

## Running the Test

### Option 1: Using the provided script

We've created a convenient script that automatically loads the environment variables from your `.env` file and runs the database connection test:

```bash
# Run from project root
./scripts/run-db-test.sh
```

### Option 2: Running the test script directly

If you prefer, you can run the test script directly:

```bash
# Run from project root
node scripts/test-db-connection.js
```

## Troubleshooting

If the database connection test fails, check the following:

1. Verify that all required variables are correctly set in your `.env` file
2. Ensure the SQL server is accessible from your current network
3. Check that the SQL credentials are valid
4. If using Azure Key Vault, ensure your application has proper access permissions

For more detailed troubleshooting steps, refer to the [Database Troubleshooting Guide](../docs/DatabaseTroubleshooting.md).

## Next Steps

After confirming your database connection works correctly, you can run the full application:

```bash
npm run dev
```

This will start the application in development mode, using the same environment variables for database connectivity.
