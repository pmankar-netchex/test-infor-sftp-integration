/**
 * Main application entry point
 */
// Load environment variables through our centralized config service
const configService = require('./src/utils/configService');
const express = require('express');
const schedule = require('node-schedule');
const path = require('path');
const logger = require('./src/utils/logger');
const orchestrationService = require('./src/services/orchestrationService');
const appInsights = require('./src/utils/appInsights');

// Initialize Application Insights
appInsights.initializeAppInsights();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API endpoint to manually trigger processing
app.post('/api/process', async (req, res) => {
  logger.info('Manual process triggered via API');
  
  try {
    // Start the processing in the background
    processData().catch(error => {
      logger.error('Background processing failed:', error);
    });
    
    // Respond immediately
    res.status(202).json({
      status: 'Processing started',
      timestamp: new Date().toISOString(),
      message: 'Data processing has been initiated in the background'
    });
  } catch (error) {
    logger.error('Failed to start processing:', error);
    res.status(500).json({ 
      status: 'Error', 
      message: 'Failed to start processing',
      timestamp: new Date().toISOString()
    });
  }
});

// Function to process data
async function processData() {
  logger.info('Starting data processing job');
  
  try {
    const result = await orchestrationService.processAllCompanies();
    logger.info('Data processing job completed', { summary: result });
    return result;
  } catch (error) {
    logger.error('Data processing job failed:', error);
    throw error;
  }
}

// Start the Express server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  
  // Schedule the job based on configuration
  const scheduleInterval = configService.get('schedule.interval');
  
  // Set up scheduled job
  const job = schedule.scheduleJob(scheduleInterval, async () => {
    logger.info(`Running scheduled job at ${new Date().toISOString()}`);
    
    try {
      await processData();
    } catch (error) {
      logger.error('Scheduled job failed:', error);
    }
  });
  
  logger.info(`Job scheduled to run at interval: ${scheduleInterval}`);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received. Shutting down gracefully...');
  // Close resources
  await cleanupResources();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received. Shutting down gracefully...');
  // Close resources
  await cleanupResources();
  process.exit(0);
});

// Cleanup function to close resources
async function cleanupResources() {
  try {
    // Close database connections
    const databaseService = require('./src/services/databaseService');
    await databaseService.close();
    logger.info('Resources cleaned up successfully');
  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}
