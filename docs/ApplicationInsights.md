# Azure Application Insights Integration

This document describes how the Azure SFTP Integration application integrates with Azure Application Insights for monitoring and telemetry.

## Overview

Azure Application Insights provides robust application performance monitoring (APM) capabilities, allowing us to:

- Track custom events and metrics
- Monitor exceptions and failures
- Measure performance and reliability
- Create dashboards and alerts based on telemetry data

## Implementation

The integration is implemented in the following ways:

1. **Initialization**: The Application Insights SDK is initialized in `index.js` during application startup.
2. **Service Telemetry**: The `orchestrationService.js` tracks events and metrics for company processing jobs.
3. **Deployment**: The Bicep templates have been updated to include Application Insights resource creation.
4. **Custom Events**: We track key business events such as job starts, completions, and failures.

## Key Metrics and Events

The application tracks the following:

### Events
- `CompanyProcessingStarted`: When processing of a company begins
- `CompanyProcessingCompleted`: When company processing completes successfully
- `BulkProcessingStarted`: When batch processing of all companies begins
- `BulkProcessingCompleted`: When batch processing completes
- `BulkProcessingFailed`: When batch processing encounters a critical error

### Metrics
- `CompanyProcessingTime`: Time taken to process each company (ms)
- `BulkProcessingTime`: Time taken for a complete processing run (seconds)
- `BulkProcessingSuccessRate`: Percentage of companies successfully processed
- `CompaniesToProcess`: Number of companies in a batch

### Dependencies
- Database queries
- API requests
- Storage operations

## Configuration

The Application Insights instrumentation key is expected to be provided in one of two ways:

1. In production: Via the `APPINSIGHTS_INSTRUMENTATIONKEY` environment variable, set during deployment
2. In development: No telemetry is sent by default

## Dashboard and Alerts

Using Azure Portal, you can:

1. Create a custom dashboard to monitor:
   - Processing success rates
   - Average processing times
   - Failure rates and exceptions
   - Resource utilization

2. Set up alerts for:
   - Processing failures exceeding threshold
   - Processing times above threshold
   - Exception rates
   - Service availability

## Deployment

The `deploy-with-monitoring.sh` script handles:
1. Creating the Application Insights resource
2. Retrieving the instrumentation key
3. Setting the key in App Service application settings
4. Deploying the application with monitoring enabled
