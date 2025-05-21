// Set NODE_ENV to test for all tests
process.env.NODE_ENV = 'test';

// Load environment variables from .env file if exists
try {
  require('dotenv').config();
} catch (error) {
  console.log('No .env file found, using defaults');
}

// Set default environment variables for testing if not already set
process.env.SQL_SERVER = process.env.SQL_SERVER || 'mock-server';
process.env.SQL_DATABASE = process.env.SQL_DATABASE || 'mock-db';
process.env.STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME || 'mockstorage';
process.env.FILE_SHARE_NAME = process.env.FILE_SHARE_NAME || 'mockshare';
process.env.SCHEDULE_INTERVAL = process.env.SCHEDULE_INTERVAL || '*/30 * * * *';

// Global test setup
global.beforeAll(() => {
  console.log('Starting test suite with environment:', process.env.NODE_ENV);
});

// Global test teardown
global.afterAll(() => {
  console.log('Test suite completed');
});
