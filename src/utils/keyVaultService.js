/**
 * Utility for accessing Azure Key Vault secrets
 */
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const configService = require('./configService');
const logger = require('./logger');

class KeyVaultService {
  constructor() {
    this.initialized = false;
    this.secretClient = null;
    this.keyVaultName = configService.get('azure.keyVault.name');
    this.keyVaultUrl = `https://${this.keyVaultName}.vault.azure.net`;
  }

  /**
   * Initialize the Key Vault client
   */
  async initialize() {
    try {
      if (this.initialized) return;

      // Use DefaultAzureCredential for authentication which supports
      // Managed Identity, Environment Variables, and CLI login
      const credential = new DefaultAzureCredential();
      this.secretClient = new SecretClient(this.keyVaultUrl, credential);
      this.initialized = true;
      logger.info(`Key Vault client initialized for ${this.keyVaultUrl}`);
    } catch (error) {
      logger.error(`Failed to initialize Key Vault client: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Get a secret from Key Vault
   * 
   * @param {string} secretName - Name of the secret to retrieve
   * @returns {Promise<string>} - The secret value
   */
  async getSecret(secretName) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const secret = await this.secretClient.getSecret(secretName);
      return secret.value;
    } catch (error) {
      logger.error(`Error retrieving secret "${secretName}": ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Set a secret in Key Vault
   * 
   * @param {string} secretName - Name of the secret to set
   * @param {string} secretValue - Value of the secret
   * @returns {Promise<void>}
   */
  async setSecret(secretName, secretValue) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await this.secretClient.setSecret(secretName, secretValue);
      logger.info(`Secret "${secretName}" successfully set in Key Vault`);
    } catch (error) {
      logger.error(`Error setting secret "${secretName}": ${error.message}`, { error });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new KeyVaultService();
