/**
 * Database Connection Test Utility
 * 
 * This utility script tests connection to the SQL database
 * and provides diagnostics for troubleshooting.
 * Reads configuration from .env file for consistent testing.
 */
const path = require('path');
const dotenv = require('dotenv');

// Ensure .env file is loaded BEFORE importing any other modules
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Now import the services (after environment variables are loaded)
const dbService = require('../src/services/databaseService');
const configService = require('../src/utils/configService');
const logger = require('../src/utils/logger');

async function testDBConnection() {
  console.log('*** SQL Database Connection Test ***');
  console.log('');
  
  // Display environment information
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  
  // Display values from .env file (without exposing sensitive info)
  console.log('Environment Variables from .env:');
  console.log(`- SQL_SERVER: ${process.env.SQL_SERVER ? process.env.SQL_SERVER : 'Not set'}`);
  console.log(`- SQL_DATABASE: ${process.env.SQL_DATABASE ? process.env.SQL_DATABASE : 'Not set'}`);
  console.log(`- SQL_USER: ${process.env.SQL_USER ? '******** (set)' : 'Not set'}`);
  console.log(`- SQL_PASSWORD: ${process.env.SQL_PASSWORD ? '******** (set)' : 'Not set'}`);
  console.log(`- KEY_VAULT_NAME: ${process.env.KEY_VAULT_NAME || 'Not set'}`);
  console.log('');
  
  // Display database configuration (without credentials)
  const dbConfig = configService.get('database');
  console.log('Database Configuration from configService:');
  console.log(`- Server: ${dbConfig.server}`);
  console.log(`- Database: ${dbConfig.database}`);
  console.log(`- Authentication: ${dbConfig.authentication ? 'Azure AD' : 'SQL Authentication'}`);
  console.log(`- Username: ${dbConfig.user || 'Not applicable (using Managed Identity)'}`);
  console.log(`- Encrypt: ${dbConfig.options.encrypt}`);
  console.log(`- Trust Server Certificate: ${dbConfig.options.trustServerCertificate}`);
  console.log('');
  
  // Test connection
  console.log('Attempting database connection...');
  
  try {
    const startTime = Date.now();
    const pool = await dbService.initialize();
    const endTime = Date.now();
    
    console.log('✓ Connection successful!');
    console.log(`- Connection time: ${endTime - startTime}ms`);
    
    // Test a simple query
    console.log('\nExecuting test query...');
    const result = await pool.request().query('SELECT @@VERSION as version');
    console.log('✓ Query executed successfully');
    console.log('SQL Server version:');
    console.log(result.recordset[0].version);
    
    // Close the connection
    await dbService.close();
    console.log('\nConnection closed properly.');
    console.log('\nTest completed successfully! ✅');
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error(`Error message: ${error.message}`);
    console.error('\nPossible issues:');
    console.error('1. SQL Server credentials are incorrect.');
    console.error('2. SQL Server is not running or unreachable.');
    console.error('3. Firewall is blocking the connection.');
    console.error('4. SSL/TLS certificate validation issues.');
    console.error('\nDetailed error:');
    console.error(error);
    
    console.log('\nTroubleshooting tips:');
    console.log('1. Verify environment variables in .env file: SQL_SERVER, SQL_DATABASE, SQL_USER, SQL_PASSWORD');
    console.log('2. Check if SQL Server is running and accessible');
    console.log('3. For SSL errors, ensure trustServerCertificate is true in development');
    console.log('4. Try creating a telnet connection to the server:');
    console.log(`   telnet ${dbConfig.server} 1433`);
    
    process.exit(1);
  }
}

// Execute the test
testDBConnection().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
