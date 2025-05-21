/**
 * Service to transform database data into the required JSON format
 */
const logger = require('../utils/logger');

class DataTransformationService {
  /**
   * Transform employee records into the required JSON format
   * 
   * @param {Array<Object>} employeeRecords - Raw employee records from database
   * @returns {Object} Transformed JSON object in the required format
   */
  transformEmployeeData(employeeRecords) {
    try {
      // Early return if no records
      if (!employeeRecords || employeeRecords.length === 0) {
        return { Report_Entry: [] };
      }

      logger.info(`Transforming ${employeeRecords.length} employee records`);
      
      // Group by UserId since each user can have multiple positions
      const employeeMap = new Map();
      
      employeeRecords.forEach(record => {
        const userId = record.UserId;
        
        // If this is the first time seeing this user, create a new entry
        if (!employeeMap.has(userId)) {
          employeeMap.set(userId, {
            UserId: record.UserId,
            Status: record.Status,
            Email: record.Email,
            FirstName: record.FirstName,
            LastName: record.LastName,
            Positions: [],
            HireDate: this.formatDate(record.HireDate),
            TermDate: this.formatDate(record.TermDate),
            PhoneNumber: record.PhoneNumber,
            DateofBirth: this.formatDate(record.DateofBirth),
            SSN: record.SSN
          });
        }
        
        // Add position information
        if (record.JobCode) {
          employeeMap.get(userId).Positions.push({
            PayRate: record.PayRate,
            JobCode: record.JobCode,
            PrimaryJob: record.PrimaryJob === 1 || record.PrimaryJob === true ? 1 : 0
          });
        }
      });
      
      // Convert Map to array of employee objects
      const employeeEntries = Array.from(employeeMap.values());
      
      // Create the final JSON structure
      const result = {
        Report_Entry: employeeEntries
      };
      
      logger.info(`Transformed data for ${employeeEntries.length} employees`);
      return result;
    } catch (error) {
      logger.error(`Error transforming employee data: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Format a date to YYYY-MM-DD format
   * 
   * @param {Date|string|null} date - Date to format
   * @returns {string|null} Formatted date or null
   */
  formatDate(date) {
    if (!date) return null;
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    
    return d.toISOString().split('T')[0];
  }
}

// Export singleton instance
module.exports = new DataTransformationService();
