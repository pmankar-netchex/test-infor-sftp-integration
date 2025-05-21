const databaseService = require('../src/services/databaseService');
const sql = require('mssql');

// Mock sql module
jest.mock('mssql', () => {
  const mockRequest = {
    input: jest.fn().mockReturnThis(),
    query: jest.fn()
  };
  
  const mockPool = {
    request: jest.fn().mockReturnValue(mockRequest),
    close: jest.fn().mockResolvedValue(true),
    on: jest.fn()
  };
  
  return {
    ConnectionPool: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(mockPool)
    }))
  };
});

// Mock config
jest.mock('config', () => ({
  get: jest.fn().mockImplementation((param) => {
    if (param === 'database') {
      return {
        server: 'test-server',
        database: 'test-db',
        options: { encrypt: true }
      };
    }
    return null;
  })
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock keyVaultService
jest.mock('../src/utils/keyVaultService', () => ({
  getSecret: jest.fn()
}));

describe('Database Service', () => {
  let mockPool;
  let mockRequest;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock pool and request for each test
    mockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn()
    };
    
    mockPool = {
      request: jest.fn().mockReturnValue(mockRequest),
      close: jest.fn().mockResolvedValue(true),
      on: jest.fn()
    };
    
    sql.ConnectionPool.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(mockPool)
    }));
  });
  
  describe('getCompanyIds', () => {
    test('should return an array of company IDs', async () => {
      // Mock data
      const mockCompanies = {
        'company1': { CompanyId: 'company1' },
        'company2': { CompanyId: 'company2' },
        'company3': { CompanyId: 'company3' }
      };
      
      // Mock getAllCompaniesWithEmployees to return data with companies
      const mockCachedData = {
        companies: mockCompanies,
        employeesByCompany: {}
      };
      
      jest.spyOn(databaseService, 'getAllCompaniesWithEmployees')
        .mockResolvedValueOnce(mockCachedData);
      
      // Call the method
      const result = await databaseService.getCompanyIds();
      
      // Assertions
      expect(result).toEqual(['company1', 'company2', 'company3']);
    });
    
    test('should return empty array when no companies found', async () => {
      // Mock getAllCompaniesWithEmployees to return empty companies data
      const mockCachedData = {
        companies: {},
        employeesByCompany: {}
      };
      
      jest.spyOn(databaseService, 'getAllCompaniesWithEmployees')
        .mockResolvedValueOnce(mockCachedData);
      
      // Call the method
      const result = await databaseService.getCompanyIds();
      
      // Assertions
      expect(result).toEqual([]);
    });
    
    test('should handle errors properly', async () => {
      // Mock getAllCompaniesWithEmployees to throw an error
      jest.spyOn(databaseService, 'getAllCompaniesWithEmployees')
        .mockRejectedValueOnce(new Error('SQL query failed'));
      
      // Call the method and expect it to throw
      await expect(databaseService.getCompanyIds()).rejects.toThrow('SQL query failed');
    });
  });
  
  describe('getCompanyDetails', () => {
    test('should return company details for a valid ID', async () => {
      // Mock getAllCompaniesWithEmployees implementation for this test
      const mockCompanyInfo = {
        CompanyId: 'company1',
        CompanyName: 'Test Company',
        CompanyCode: '5678',
        Address1: '123 Main St',
        City: 'Seattle',
        State: 'WA',
        ZipCode: '98001',
        AreaCode: '555',
        Phone: '1234567',
        Active: 1
      };
      
      // Mock the getCompanyInfo method
      const getCompanyInfoSpy = jest.spyOn(databaseService, 'getCompanyInfo')
        .mockResolvedValueOnce(mockCompanyInfo);
      
      // Call the method
      const result = await databaseService.getCompanyDetails('company1');
      
      // Assertions
      expect(getCompanyInfoSpy).toHaveBeenCalledWith('company1');
      expect(result).toEqual({
        id: 'company1',
        name: 'Test Company',
        storeNumber: '5678',
        address: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        zipCode: '98001',
        phoneNumber: '5551234567',
        active: true
      });
    });
    
    test('should return null when company not found', async () => {
      // Mock getCompanyInfo to return null (company not found)
      jest.spyOn(databaseService, 'getCompanyInfo').mockResolvedValueOnce(null);
      
      const result = await databaseService.getCompanyDetails('nonexistent');
      
      expect(result).toBeNull();
    });
    
    test('should handle errors properly', async () => {
      // Mock getCompanyInfo to throw an error
      jest.spyOn(databaseService, 'getCompanyInfo')
        .mockRejectedValueOnce(new Error('Database error'));
      
      await expect(databaseService.getCompanyDetails('company1'))
        .rejects.toThrow('Database error');
    });
  });
  
  describe('getCompanyInfo', () => {
    test('should return company info from the cache for a valid ID', async () => {
      // Mock the getAllCompaniesWithEmployees method to return cached data
      const mockCachedData = {
        companies: {
          'company1': {
            CompanyId: 'company1',
            CompanyName: 'Test Company',
            CompanyCode: '5678'
          }
        },
        employeesByCompany: {
          'company1': [
            { UserId: '1', FirstName: 'John', LastName: 'Doe' }
          ]
        }
      };
      
      jest.spyOn(databaseService, 'getAllCompaniesWithEmployees')
        .mockResolvedValueOnce(mockCachedData);
      
      // Call the method
      const result = await databaseService.getCompanyInfo('company1');
      
      // Assertions
      expect(result).toEqual(mockCachedData.companies['company1']);
    });
    
    test('should return null when company not found', async () => {
      // Mock getAllCompaniesWithEmployees to return data without the requested company
      const mockCachedData = {
        companies: {
          'company2': { CompanyId: 'company2' }
        },
        employeesByCompany: {
          'company2': []
        }
      };
      
      jest.spyOn(databaseService, 'getAllCompaniesWithEmployees')
        .mockResolvedValueOnce(mockCachedData);
      
      const result = await databaseService.getCompanyInfo('company1');
      
      expect(result).toBeNull();
    });
    
    test('should handle errors properly', async () => {
      // Mock getAllCompaniesWithEmployees to throw an error
      jest.spyOn(databaseService, 'getAllCompaniesWithEmployees')
        .mockRejectedValueOnce(new Error('Cache retrieval failed'));
      
      await expect(databaseService.getCompanyInfo('company1'))
        .rejects.toThrow('Cache retrieval failed');
    });
  });
  
  describe('getEmployeeRecords', () => {
    test('should return employee records for a company', async () => {
      // Mock data
      const companyId = 'company1';
      const mockEmployees = [
        { UserId: 'user1', FirstName: 'John', LastName: 'Doe' },
        { UserId: 'user2', FirstName: 'Jane', LastName: 'Smith' }
      ];
      
      // Mock getAllCompaniesWithEmployees to return data with employees
      const mockCachedData = {
        companies: {
          'company1': { CompanyId: 'company1' }
        },
        employeesByCompany: {
          'company1': mockEmployees
        }
      };
      
      jest.spyOn(databaseService, 'getAllCompaniesWithEmployees')
        .mockResolvedValueOnce(mockCachedData);
      
      // Call the method
      const result = await databaseService.getEmployeeRecords(companyId);
      
      // Assertions
      expect(result).toEqual(mockEmployees);
    });
    
    test('should return empty array when company has no employees', async () => {
      // Mock getAllCompaniesWithEmployees to return data with no employees for the company
      const mockCachedData = {
        companies: {
          'company1': { CompanyId: 'company1' }
        },
        employeesByCompany: {
          'company1': [] // Empty employees array
        }
      };
      
      jest.spyOn(databaseService, 'getAllCompaniesWithEmployees')
        .mockResolvedValueOnce(mockCachedData);
      
      const result = await databaseService.getEmployeeRecords('company1');
      
      expect(result).toEqual([]);
    });
    
    test('should return empty array when company not found', async () => {
      // Mock getAllCompaniesWithEmployees to return data without the requested company
      const mockCachedData = {
        companies: {
          'company2': { CompanyId: 'company2' }
        },
        employeesByCompany: {
          'company2': [{ UserId: 'user3' }]
        }
      };
      
      jest.spyOn(databaseService, 'getAllCompaniesWithEmployees')
        .mockResolvedValueOnce(mockCachedData);
      
      const result = await databaseService.getEmployeeRecords('company1');
      
      expect(result).toEqual([]);
    });
    
    test('should handle errors properly', async () => {
      // Mock getAllCompaniesWithEmployees to throw an error
      jest.spyOn(databaseService, 'getAllCompaniesWithEmployees')
        .mockRejectedValueOnce(new Error('Cache retrieval failed'));
      
      await expect(databaseService.getEmployeeRecords('company1'))
        .rejects.toThrow('Cache retrieval failed');
    });
  });
});
