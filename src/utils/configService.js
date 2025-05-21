/**
 * Configuration service for the SFTP integration application
 * Centralizes access to app configuration and env variables
 */
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Determine the environment
const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * Configuration class to manage application settings
 */
class Configuration {
  constructor() {
    this.config = {
      app: {
        name: 'azure-sftp-integration',
        env: nodeEnv
      },
      database: {
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
        // In production, use managed identity; otherwise, use SQL credentials
        ...(nodeEnv === 'production' 
          ? {
              authentication: {
                type: 'azure-active-directory-msi-app-service'
              }
            } 
          : {
              user: process.env.SQL_USER,
              password: process.env.SQL_PASSWORD
            }
        ),
        options: {
          encrypt: true,
          enableArithAbort: true,
          trustServerCertificate: true, // Allow self-signed certificates in development
          connectTimeout: 30000, // Increase connection timeout to 30 seconds
          requestTimeout: 60000 // Increase request timeout to 60 seconds
        },
        pool: {
          max: nodeEnv === 'production' ? 20 : 10,
          min: nodeEnv === 'production' ? 5 : 0,
          idleTimeoutMillis: 30000
        }
      },
      azure: {
        keyVault: {
          name: process.env.KEY_VAULT_NAME
        },
        storage: {
          accountName: process.env.STORAGE_ACCOUNT_NAME,
          fileShareName: process.env.FILE_SHARE_NAME,
          accountKey: process.env.STORAGE_ACCOUNT_KEY
        }
      },
      schedule: {
        interval: process.env.SCHEDULE_INTERVAL
      },
      concurrency: {
        maxThreads: nodeEnv === 'production' ? 10 : 5
      },
      logging: {
        level: nodeEnv === 'production' ? 'error' : 'info',
        file: 'logs/app.log'
      }
    };
  }

  /**
   * Get a configuration value with support for dot notation
   * @param {string} key - The key to retrieve (supports dot notation)
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} The configuration value or default
   */
  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let result = this.config;
    
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        return defaultValue;
      }
    }
    
    return result;
  }

  /**
   * Check if the app is running in production mode
   * @returns {boolean} True if in production mode
   */
  isProduction() {
    return this.config.app.env === 'production';
  }

  /**
   * Check if the app is running in development mode
   * @returns {boolean} True if in development mode
   */
  isDevelopment() {
    return this.config.app.env === 'development';
  }

  /**
   * Check if the app is running in test mode
   * @returns {boolean} True if in test mode
   */
  isTest() {
    return this.config.app.env === 'test';
  }
}

// Export a singleton instance
const configInstance = new Configuration();
module.exports = configInstance;
