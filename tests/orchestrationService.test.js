const orchestrationService = require('../src/services/orchestrationService');

// Mock dependencies
jest.mock('../src/services/databaseService', () => ({
  getCompanyIds: jest.fn(),
  getCompanyDetails: jest.fn(),
  getEmployeeRecords: jest.fn(),
  close: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/dataTransformationService', () => ({
  transformEmployeeData: jest.fn()
}));

jest.mock('../src/services/sftpService', () => ({
  generateFilename: jest.fn(),
  uploadFile: jest.fn().mockResolvedValue(true),
  initialize: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/utils/appInsights', () => ({
  trackEvent: jest.fn(),
  trackMetric: jest.fn(),
  trackException: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Import the mocked dependencies for test control
const databaseService = require('../src/services/databaseService');
const dataTransformationService = require('../src/services/dataTransformationService');
const sftpService = require('../src/services/sftpService');
const appInsights = require('../src/utils/appInsights');

describe('Orchestration Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('processCompany', () => {
    test('should successfully process a company', async () => {
      // Mock dependencies return values
      const companyId = 'company123';
      const companyDetails = { id: companyId, storeNumber: '5678', name: 'Test Company' };
      const employeeRecords = [{ id: 'emp1' }, { id: 'emp2' }];
      const transformedData = { Report_Entry: employeeRecords };
      const filename = '5678InforEmpData05202025103045.json';
      
      databaseService.getCompanyDetails.mockResolvedValue(companyDetails);
      databaseService.getEmployeeRecords.mockResolvedValue(employeeRecords);
      dataTransformationService.transformEmployeeData.mockReturnValue(transformedData);
      sftpService.generateFilename.mockReturnValue(filename);
      
      // Call the method
      const result = await orchestrationService.processCompany(companyId);
      
      // Assertions
      expect(databaseService.getCompanyDetails).toHaveBeenCalledWith(companyId);
      expect(databaseService.getEmployeeRecords).toHaveBeenCalledWith(companyId);
      expect(dataTransformationService.transformEmployeeData).toHaveBeenCalledWith(employeeRecords);
      expect(sftpService.generateFilename).toHaveBeenCalledWith('5678');
      expect(sftpService.uploadFile).toHaveBeenCalledWith(filename, transformedData);
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.companyId).toBe(companyId);
      expect(result.filename).toBe(filename);
    });
    
    test('should handle errors during company processing', async () => {
      // Mock dependencies to throw error
      const companyId = 'company123';
      databaseService.getCompanyDetails.mockRejectedValue(new Error('Database error'));
      
      // Call the method
      const result = await orchestrationService.processCompany(companyId);
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.companyId).toBe(companyId);
      expect(result.error).toBe('Database error');
      expect(appInsights.trackException).toHaveBeenCalled();
    });
  });
  
  describe('processAllCompanies', () => {
    test('should successfully process all companies', async () => {
      // Mock dependencies return values
      const companyIds = ['company1', 'company2', 'company3'];
      const results = [
        { companyId: 'company1', success: true },
        { companyId: 'company2', success: true },
        { companyId: 'company3', success: true }
      ];
      
      databaseService.getCompanyIds.mockResolvedValue(companyIds);
      
      // Mock processCompany to avoid implementing promise pool mock
      const originalProcessCompany = orchestrationService.processCompany;
      orchestrationService.processCompany = jest.fn()
        .mockResolvedValueOnce(results[0])
        .mockResolvedValueOnce(results[1])
        .mockResolvedValueOnce(results[2]);
      
      // Call the method
      const result = await orchestrationService.processAllCompanies();
      
      // Assertions
      expect(databaseService.getCompanyIds).toHaveBeenCalled();
      expect(orchestrationService.processCompany).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      expect(result.totalCompanies).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      
      // Restore original method
      orchestrationService.processCompany = originalProcessCompany;
    });
    
    test('should handle no companies found', async () => {
      // Mock empty company list
      databaseService.getCompanyIds.mockResolvedValue([]);
      
      // Call the method
      const result = await orchestrationService.processAllCompanies();
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.message).toContain('No companies found');
    });
    
    test('should handle errors during batch processing', async () => {
      // Mock database error
      databaseService.getCompanyIds.mockRejectedValue(new Error('Database batch error'));
      
      // Call the method
      const result = await orchestrationService.processAllCompanies();
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to process companies');
      expect(result.error).toBe('Database batch error');
      expect(appInsights.trackException).toHaveBeenCalled();
    });
  });
});
