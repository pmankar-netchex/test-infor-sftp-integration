/**
 * Orchestration service to coordinate the end-to-end process
 */
const configService = require('../utils/configService');
const logger = require('../utils/logger');
const databaseService = require('./databaseService');
const dataTransformationService = require('./dataTransformationService');
const sftpService = require('./sftpService');
const appInsights = require('../utils/appInsights');
const { promisePool } = require('../utils/promisePool');

class OrchestrationService {
  /**
   * Process a single company
   * 
   * @param {string} companyId - ID of the company to process
   * @returns {Promise<Object>} Result of the processing
   */
  async processCompany(companyId) {
    const startTime = Date.now();
    
    try {
      logger.info(`Processing company ID: ${companyId}`);
      appInsights.trackEvent('CompanyProcessingStarted', { companyId });
      
      // 1. Get company details from database
      const companyDetails = await databaseService.getCompanyDetails(companyId);
      if (!companyDetails) {
        throw new Error(`No details found for company ID: ${companyId}`);
      }
      
      // 2. Get employee records from database
      const employeeRecords = await databaseService.getEmployeeRecords(companyId);
      
      // 3. Transform data to required format
      const transformedData = dataTransformationService.transformEmployeeData(employeeRecords);
      
      // 4. Generate filename using store number from company details
      const storeNumber = companyDetails.storeNumber || companyId;
      const filename = sftpService.generateFilename(storeNumber);
      
      // 5. Upload file to Azure File Share
      await sftpService.uploadFile(filename, transformedData);
      
      const processingTime = Date.now() - startTime;
      logger.info(`Successfully processed company ${companyId}, generated file: ${filename}`);
      
      // Track successful completion
      appInsights.trackEvent('CompanyProcessingCompleted', { 
        companyId, 
        storeNumber, 
        filename, 
        recordCount: employeeRecords.length,
        processingTimeMs: processingTime
      });
      
      // Track processing time metric
      appInsights.trackMetric('CompanyProcessingTime', processingTime, {
        companyId,
        storeNumber,
        recordCount: employeeRecords.length
      });
      
      return {
        companyId,
        storeNumber,
        filename,
        recordCount: employeeRecords.length,
        processingTimeMs: processingTime,
        success: true
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Failed to process company ${companyId}: ${error.message}`, { error });
      
      // Track exception
      appInsights.trackException(error, { 
        companyId, 
        processingTimeMs: processingTime,
        operation: 'processCompany'
      });
      
      return {
        companyId,
        processingTimeMs: processingTime,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process all companies with limited concurrency
   * 
   * @returns {Promise<Object>} Processing results summary
   */
  async processAllCompanies() {
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    let results = [];
    
    try {
      logger.info('Starting to process all companies');
      appInsights.trackEvent('BulkProcessingStarted');
      
      // 1. Get all company IDs from database
      const companyIds = await databaseService.getCompanyIds();
      logger.info(`Retrieved ${companyIds.length} company IDs to process`);
      
      // Track companies count
      appInsights.trackMetric('CompaniesToProcess', companyIds.length);
      
      if (!companyIds || companyIds.length === 0) {
        const result = {
          success: false,
          message: 'No companies found to process',
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
          elapsedSeconds: (Date.now() - startTime) / 1000,
          totalCompanies: 0,
          successful: 0,
          failed: 0,
          results: []
        };
        
        appInsights.trackEvent('BulkProcessingCompleted', result);
        return result;
      }
      
      // 2. Process companies with limited concurrency
      const maxThreads = configService.get('concurrency.maxThreads');
      
      // Use promise pool to limit concurrency
      results = await promisePool({
        concurrency: maxThreads,
        items: companyIds,
        task: (companyId) => this.processCompany(companyId)
      });
      
      // 3. Count successes and failures
      for (const result of results) {
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      }
      
      logger.info(`Completed processing ${companyIds.length} companies. Success: ${successful}, Failed: ${failed}`);
      
      // Create summary result object
      const summary = {
        success: failed === 0,
        message: `Processed ${companyIds.length} companies. Success: ${successful}, Failed: ${failed}`,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        elapsedSeconds: (Date.now() - startTime) / 1000,
        totalCompanies: companyIds.length,
        successful,
        failed,
        results
      };
      
      // Track bulk processing metrics
      appInsights.trackEvent('BulkProcessingCompleted', {
        totalCompanies: companyIds.length,
        successful,
        failed,
        elapsedSeconds: (Date.now() - startTime) / 1000
      });
      
      appInsights.trackMetric('BulkProcessingSuccessRate', (successful / companyIds.length) * 100);
      appInsights.trackMetric('BulkProcessingTime', (Date.now() - startTime) / 1000);
      
      return summary;
    } catch (error) {
      const errorMessage = `Failed to process companies: ${error.message}`;
      logger.error(errorMessage, { error });
      
      // Track the exception
      appInsights.trackException(error, {
        operation: 'processAllCompanies',
        elapsedSeconds: (Date.now() - startTime) / 1000,
        totalCompanies: results.length,
        successful,
        failed
      });
      
      const result = {
        success: false,
        message: errorMessage,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        elapsedSeconds: (Date.now() - startTime) / 1000,
        totalCompanies: results.length,
        successful,
        failed: failed + 1, // +1 for the overall failure
        results,
        error: error.message
      };
      
      appInsights.trackEvent('BulkProcessingFailed', {
        error: error.message,
        elapsedSeconds: (Date.now() - startTime) / 1000
      });
      
      return result;
    }
  }
}

// Export singleton instance
module.exports = new OrchestrationService();
