const sftpService = {
  generateFilename: jest.fn(),
  uploadFile: jest.fn(),
  initialize: jest.fn()
};

sftpService.generateFilename.mockImplementation((storeNumber) => {
  // Mock implementation to match the real one
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const paddedStoreNumber = String(storeNumber).padStart(4, '0');
  
  return `${paddedStoreNumber}InforEmpData${month}${day}${year}${hours}${minutes}${seconds}.json`;
});

module.exports = sftpService;
