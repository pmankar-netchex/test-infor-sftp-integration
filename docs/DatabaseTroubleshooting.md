# Database Connection Troubleshooting Guide

This guide provides steps to troubleshoot SQL Server connection issues in the SFTP Integration application.

## Verifying Environment Variables

Before troubleshooting specific errors, ensure your environment variables are correctly loaded:

1. Check that your `.env` file exists in the project root directory
2. Verify it contains all required database connection variables:
   ```
   SQL_SERVER=your-sql-server
   SQL_DATABASE=your-database
   SQL_USER=your-username
   SQL_PASSWORD=your-password
   ```
3. Run the database test script to validate `.env` loading:
   ```
   ./scripts/run-db-test.sh
   ```
4. Examine the output to confirm variables are being read correctly

## Common SQL Connection Errors

### 1. "Login failed for user 'sqladmin'"

**Cause**: Incorrect username or password in SQL authentication.

**Solution**:
- Verify the SQL_USER and SQL_PASSWORD in your .env file
- Make sure the user exists in SQL Server and has the correct password
- Check if the SQL login is disabled or expired

### 2. "Failed to connect - self-signed certificate"

**Cause**: SSL certificate validation issues when connecting to SQL Server.

**Solution**:
- In development environment, set `trustServerCertificate: true` in the options
- In production, ensure proper certificates are installed
- If using Azure SQL, ensure the connection string includes proper encryption settings

### 3. "Cannot open server requested by the login"

**Cause**: Server firewall rules preventing access.

**Solution**:
- Check SQL Server firewall rules
- For Azure SQL, add your client IP to the firewall allowlist
- Verify network connectivity between the application and SQL Server

## Diagnostic Steps

1. **Run the connection test utility**:
   ```
   node scripts/test-db-connection.js
   ```

2. **Check environment variables**:
   ```
   SQL_SERVER=your-sql-server
   SQL_DATABASE=your-database
   SQL_USER=sql-username
   SQL_PASSWORD=sql-password
   ```

3. **Verify network connectivity**:
   ```
   telnet your-sql-server 1433
   ```
   If the connection is successful, you'll see a blank screen. Press Ctrl+C to exit.

4. **Check SQL Server logs**:
   - For on-premises SQL Server, check SQL Server error logs
   - For Azure SQL, check the Azure portal for diagnostic logs

## Connection Configurations

### Development Environment
```javascript
{
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
}
```

### Production Environment (Azure)
```javascript
{
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  authentication: {
    type: 'azure-active-directory-msi-app-service'
  },
  options: {
    encrypt: true
  }
}
```

## Retry Logic

The application includes retry logic for SQL connections to handle transient errors:
- Maximum retry attempts: 3
- Delay between retries: 2 seconds

## Performance Considerations

- Connection pool settings are optimized based on environment:
  - Development: Min 0, Max 10 connections
  - Production: Min 5, Max 20 connections
- Connection timeout: 30 seconds
- Request timeout: 60 seconds
