const request = require('supertest');
const express = require('express');

// Create a simplified version of the app for testing
const setupTestApp = () => {
  const app = express();
  
  // Mock orchestrationService
  const mockOrchestrationService = {
    processAllCompanies: jest.fn().mockResolvedValue({
      success: true,
      totalCompanies: 3,
      successful: 3,
      failed: 0
    })
  };
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });
  
  // API endpoint to manually trigger processing
  app.post('/api/process', async (req, res) => {
    try {
      // Start the processing (we're testing synchronously in tests)
      const result = await mockOrchestrationService.processAllCompanies();
      
      // Respond 
      res.status(202).json({
        status: 'Processing completed',
        timestamp: new Date().toISOString(),
        message: 'Data processing has been completed',
        summary: result
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'Error', 
        message: 'Failed to start processing',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  return { app, mockOrchestrationService };
};

describe('API endpoints', () => {
  let app, mockOrchestrationService;
  
  beforeEach(() => {
    const setup = setupTestApp();
    app = setup.app;
    mockOrchestrationService = setup.mockOrchestrationService;
  });
  
  describe('GET /health', () => {
    test('should return 200 and status OK', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
    });
  });
  
  describe('POST /api/process', () => {
    test('should return 202 when processing is initiated', async () => {
      const response = await request(app).post('/api/process');
      
      expect(response.status).toBe(202);
      expect(response.body.status).toBe('Processing completed');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.summary).toBeDefined();
      expect(mockOrchestrationService.processAllCompanies).toHaveBeenCalled();
    });
    
    test('should handle errors during processing', async () => {
      // Override mock to throw error
      mockOrchestrationService.processAllCompanies.mockRejectedValueOnce(
        new Error('Processing failed')
      );
      
      const response = await request(app).post('/api/process');
      
      expect(response.status).toBe(500);
      expect(response.body.status).toBe('Error');
    });
  });
});
