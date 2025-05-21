const sftpService = require('../src/services/sftpService');

// Mock the Azure Storage SDK
jest.mock('@azure/storage-file-share', () => ({
  ShareServiceClient: jest.fn().mockImplementation(() => ({
    getShareClient: jest.fn().mockImplementation(() => ({
      exists: jest.fn().mockResolvedValue(true),
      create: jest.fn().mockResolvedValue({}),
      rootDirectoryClient: {
        createIfNotExists: jest.fn().mockResolvedValue({}),
        getFileClient: jest.fn().mockReturnValue({
          create: jest.fn().mockResolvedValue({}),
          uploadRange: jest.fn().mockResolvedValue({}),
          deleteIfExists: jest.fn().mockResolvedValue({})
        }),
        listFilesAndDirectories: jest.fn().mockImplementation(function* () {
          yield { kind: 'file', name: 'test-file-1.json' };
          yield { kind: 'file', name: 'test-file-2.json' };
        })
      }
    }))
  })),
  ShareDirectoryClient: jest.fn(),
  StorageSharedKeyCredential: jest.fn()
}));

// Mock the config service module
jest.mock('../src/utils/configService', () => ({
  get: jest.fn((key) => {
    const config = {
      'azure.storage.accountName': 'teststorageaccount',
      'azure.storage.fileShareName': 'testfileshare',
      'azure.storage.accountKey': 'test-account-key'
    };
    return config[key];
  }),
  isProduction: jest.fn().mockReturnValue(false)
}));

// Mock the logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock the Key Vault service
jest.mock('../src/utils/keyVaultService', () => ({
  getSecret: jest.fn().mockResolvedValue('mock-secret')
}));

describe('SFTP Service', () => {
  describe('generateFilename', () => {
    test('should generate a filename with correct format', () => {
      // Mock date to get consistent output
      const mockDate = new Date('2025-05-20T10:30:45');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
      const storeNumber = '123';
      const expectedPrefix = '0123'; // Should be padded to 4 digits
      const expectedDatePart = '05202025103045'; // mmddyyyyhhmmss
      
      const filename = sftpService.generateFilename(storeNumber);
      
      expect(filename).toContain('InforEmpData');
      expect(filename).toMatch(new RegExp(`^${expectedPrefix}InforEmpData${expectedDatePart}\\.json$`));
      
      // Restore original Date
      jest.restoreAllMocks();
    });
    
    test('should pad store number with leading zeros', () => {
      // Use different store numbers to test padding
      const testCases = [
        { input: '1', expected: '0001' },
        { input: '12', expected: '0012' },
        { input: '123', expected: '0123' },
        { input: '1234', expected: '1234' },
        { input: '12345', expected: '12345' } // Should not truncate
      ];
      
      // Mock date to get consistent output
      const mockDate = new Date('2025-05-20T10:30:45');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
      testCases.forEach(({ input, expected }) => {
        const filename = sftpService.generateFilename(input);
        expect(filename.startsWith(expected)).toBeTruthy();
      });
      
      // Restore original Date
      jest.restoreAllMocks();
    });
  });
  
  describe('uploadFile', () => {
    test('should upload a file successfully', async () => {
      // Mock the necessary functions for this test
      const mockDirectoryClient = sftpService.fileShareClient?.rootDirectoryClient;
      const mockFileClient = mockDirectoryClient?.getFileClient('test.json');
      
      // Call the method
      const result = await sftpService.uploadFile('test.json', { test: 'data' });
      
      // Assertions
      expect(result).toBe('test.json');
    });
  });
  
  describe('listFiles', () => {
    test('should return a list of files', async () => {
      // Call the method
      const result = await sftpService.listFiles();
      
      // Assertions
      expect(result).toEqual(['test-file-1.json', 'test-file-2.json']);
    });
  });
  
  describe('deleteFile', () => {
    test('should delete a file successfully', async () => {
      // Call the method
      const result = await sftpService.deleteFile('test.json');
      
      // Assertions
      expect(result).toBe(true);
    });
  });
});
