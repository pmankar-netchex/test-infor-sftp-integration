/**
 * Application Insights integration for monitoring and telemetry
 */
const appInsights = require('applicationinsights');
const configService = require('./configService');
const logger = require('./logger');

/**
 * Initialize Application Insights
 */
const initializeAppInsights = () => {
  try {
    if (configService.isProduction()) {
      const instrumentationKey = process.env.APPINSIGHTS_INSTRUMENTATIONKEY;
      
      if (!instrumentationKey) {
        logger.warn('Application Insights instrumentation key not found, telemetry disabled');
        return false;
      }
      
      // Initialize with the instrumentation key
      appInsights.setup(instrumentationKey)
        // Add common context tags
        .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true, true)
        .setUseDiskRetryCaching(true)
        .setSendLiveMetrics(true)
        .setAutoCollectHeartbeat(true);
      
      // Add custom context tags
      appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = configService.get('app.name');
      
      // Start the client
      appInsights.start();
      
      logger.info('Application Insights initialized successfully');
      return true;
    } else {
      logger.info('Application Insights not initialized in development mode');
      return false;
    }
  } catch (error) {
    logger.error(`Failed to initialize Application Insights: ${error.message}`, { error });
    return false;
  }
};

/**
 * Track a custom event
 * 
 * @param {string} name - Name of the event
 * @param {Object} properties - Custom properties
 */
const trackEvent = (name, properties = {}) => {
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackEvent({ name, properties });
  }
};

/**
 * Track an exception
 * 
 * @param {Error} exception - The exception to track
 * @param {Object} properties - Custom properties
 */
const trackException = (exception, properties = {}) => {
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackException({ exception, properties });
  }
};

/**
 * Track a metric
 * 
 * @param {string} name - Name of the metric
 * @param {number} value - Value of the metric
 * @param {Object} properties - Custom properties
 */
const trackMetric = (name, value, properties = {}) => {
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackMetric({ name, value, properties });
  }
};

/**
 * Track a dependency
 * 
 * @param {string} name - Name of the dependency
 * @param {string} data - Command or URL
 * @param {number} duration - Duration in milliseconds
 * @param {boolean} success - Success indicator
 * @param {Object} properties - Custom properties
 */
const trackDependency = (name, data, duration, success, properties = {}) => {
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackDependency({ 
      name, 
      data, 
      duration, 
      success, 
      dependencyTypeName: 'Custom', 
      properties
    });
  }
};

module.exports = {
  initializeAppInsights,
  trackEvent,
  trackException,
  trackMetric,
  trackDependency
};
