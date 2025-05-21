/**
 * SFTP service for file uploads using Azure File Share
 */
const { ShareServiceClient, StorageSharedKeyCredential, ShareDirectoryClient } = require('@azure/storage-file-share');
const { DefaultAzureCredential } = require('@azure/identity');
const configService = require('../utils/configService');
const logger = require('../utils/logger');
const path = require('path');
const keyVaultService = require('../utils/keyVaultService');

class SftpService {
  constructor() {
    this.accountName = configService.get('azure.storage.accountName');
    this.fileShareName = configService.get('azure.storage.fileShareName');
    this.shareServiceClient = null;
    this.fileShareClient = null;
    this.useManagedIdentity = configService.isProduction();
  }

  /**
   * Initialize the Azure File Share client
   * Uses managed identity in production and storage account key in development
   */
  async initialize() {
    try {
      if (this.shareServiceClient) return;

      if (this.useManagedIdentity) {
        // Use DefaultAzureCredential for authentication in production (Managed Identity)
        const credential = new DefaultAzureCredential();
        this.shareServiceClient = new ShareServiceClient(
          `https://${this.accountName}.file.core.windows.net`,
          credential
        );
      } else {
        // For development, use storage account key from configuration
        const accountKey = configService.get('azure.storage.accountKey');
        
        // Create a new SharedKeyCredential
        const sharedKeyCredential = new StorageSharedKeyCredential(
          this.accountName,
          accountKey
        );
        
        this.shareServiceClient = new ShareServiceClient(
          `https://${this.accountName}.file.core.windows.net`,
          sharedKeyCredential
        );
      }

      this.fileShareClient = this.shareServiceClient.getShareClient(this.fileShareName);
      const shareExists = await this.fileShareClient.exists();

      if (!shareExists) {
        logger.warn(`File share '${this.fileShareName}' does not exist. Creating it...`);
        await this.fileShareClient.create();
        logger.info(`File share '${this.fileShareName}' created successfully.`);
      }

      logger.info(`SFTP service initialized with file share: ${this.fileShareName}`);
    } catch (error) {
      logger.error(`Failed to initialize SFTP service: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Generate the filename based on the specified format
   * Format: xxxxInforEmpDatammddyyyyhhmmss.json
   * where xxxx = 4-digit store number
   * 
   * @param {string} storeNumber - Store number (will be padded to 4 digits)
   * @returns {string} Formatted filename
   */
  generateFilename(storeNumber) {
    const now = new Date();
    
    // Format the date and time components
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // Ensure store number is 4 digits, padded with zeros if needed
    const paddedStoreNumber = String(storeNumber).padStart(4, '0');
    
    return `${paddedStoreNumber}InforEmpData${month}${day}${year}${hours}${minutes}${seconds}.json`;
  }

  /**
   * Upload a JSON file to the Azure File Share
   * 
   * @param {string} filename - Name of the file to create
   * @param {Object} data - JSON data to upload
   * @returns {Promise<void>}
   */
  async uploadFile(filename, data) {
    try {
      if (!this.fileShareClient) {
        await this.initialize();
      }
      
      // Get a reference to the root directory
      const directoryClient = this.fileShareClient.rootDirectoryClient;
      
      // Create file client
      const fileClient = directoryClient.getFileClient(filename);
      
      // Convert JSON to string
      const content = JSON.stringify(data, null, 2);
      
      // Create the file and upload content
      await fileClient.create(content.length);
      await fileClient.uploadRange(content, 0, content.length);
      
      logger.info(`File '${filename}' uploaded successfully to Azure File Share`);
      return filename;
    } catch (error) {
      logger.error(`Failed to upload file '${filename}': ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Get a list of files in the file share
   * 
   * @returns {Promise<string[]>} List of filenames
   */
  async listFiles() {
    try {
      if (!this.fileShareClient) {
        await this.initialize();
      }
      
      // Get a reference to the root directory
      const directoryClient = this.fileShareClient.rootDirectoryClient;
      
      // List files
      let fileNames = [];
      for await (const item of directoryClient.listFilesAndDirectories()) {
        if (item.kind === "file") {
          fileNames.push(item.name);
        }
      }
      
      logger.info(`Retrieved ${fileNames.length} files from file share`);
      return fileNames;
    } catch (error) {
      logger.error(`Failed to list files: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Delete a file from the file share
   * 
   * @param {string} filename - Name of the file to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteFile(filename) {
    try {
      if (!this.fileShareClient) {
        await this.initialize();
      }
      
      // Get a reference to the root directory
      const directoryClient = this.fileShareClient.rootDirectoryClient;
      
      // Get file client
      const fileClient = directoryClient.getFileClient(filename);
      
      // Delete the file
      await fileClient.deleteIfExists();
      
      logger.info(`File '${filename}' deleted from file share`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete file '${filename}': ${error.message}`, { error });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new SftpService();
