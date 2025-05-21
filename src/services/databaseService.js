/**
 * SQL Server database service for data operations
 * 
 * This service manages database operations for Azure SFTP integration
 * - Overall operations: Operations that work with multiple companies
 * - Company-level operations: Operations that focus on a single company
 */
const sql = require('mssql');
const configService = require('../utils/configService');
const logger = require('../utils/logger');
const keyVaultService = require('../utils/keyVaultService');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.dbConfig = configService.get('database');
    
    // Cache for efficiency
    this._companiesWithEmployeesCache = null;
    this._companiesWithEmployeesCacheTime = null;
    this._cacheExpiration = 60000; // 1 minute cache
  }

  /****************************************************
   * CONNECTION MANAGEMENT
   ****************************************************/

  /**
   * Initialize the SQL Server connection pool
   * Uses managed identity in production and username/password in development
   * @param {number} retryCount - Number of connection retry attempts (default: 3)
   * @param {number} retryDelay - Delay between retries in ms (default: 2000)
   */
  async initialize(retryCount = 3, retryDelay = 2000) {
    let attempts = 0;
    
    while (attempts <= retryCount) {
      try {
        if (this.pool) {
          return this.pool;
        }

        attempts++;
        
        // Log connection details (no sensitive information)
        logger.info(`Attempting to connect to SQL Server ${this.dbConfig.server} (Attempt ${attempts}/${retryCount + 1})`, {
          server: this.dbConfig.server,
          database: this.dbConfig.database,
          authType: this.dbConfig.authentication ? this.dbConfig.authentication.type : 'sql',
          user: this.dbConfig.user ? '(username provided)' : '(no username)',
          hasPassword: this.dbConfig.password ? 'Yes' : 'No'
        });

        // Create and connect to SQL pool
        this.pool = await new sql.ConnectionPool(this.dbConfig).connect();
        logger.info(`Connected to SQL Server ${this.dbConfig.server}`);
        
        // Handle pool errors
        this.pool.on('error', err => {
          logger.error('SQL Pool Error:', err);
          throw err;
        });
        
        return this.pool;
      } catch (error) {
        // Last attempt, throw the error
        if (attempts > retryCount) {
          logger.error(`Failed to initialize SQL connection after ${attempts} attempts: ${error.message}`, { 
            error,
            server: this.dbConfig.server,
            database: this.dbConfig.database,
            authType: this.dbConfig.authentication ? this.dbConfig.authentication.type : 'sql',
            user: this.dbConfig.user ? this.dbConfig.user : '(no username)',
            // Do not log the actual password
            hasPassword: this.dbConfig.password ? 'Yes' : 'No'
          });
          throw error;
        }
        
        // Log the error and retry
        logger.warn(`SQL connection attempt ${attempts}/${retryCount + 1} failed: ${error.message}. Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  /**
   * Get a SQL connection from the pool
   * @returns {Promise<sql.ConnectionPool>} SQL connection pool
   */
  async getConnection() {
    if (!this.pool) {
      await this.initialize();
    }
    return this.pool;
  }

  /**
   * Close the database connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      logger.info('Database connection closed');
    }
  }

  /****************************************************
   * CORE DATABASE OPERATIONS
   ****************************************************/

  /**
   * Execute a SQL query with parameters
   * 
   * @param {string} query - SQL query to execute
   * @param {Object} params - Query parameters
   * @returns {Promise<Object[]>} Query results
   */
  async executeQuery(query, params = {}) {
    try {
      const pool = await this.getConnection();
      const request = pool.request();
      
      // Add parameters to request
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
      
      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      logger.error(`SQL query execution failed: ${error.message}`, { error, query });
      throw error;
    }
  }

  /**
   * Get all company IDs from the database
   * 
   * @returns {Promise<string[]>} List of company IDs
   */
  async getCompanyIds() {
    try {
      // Get all companies data first
      const data = await this.getAllCompaniesWithEmployees();
      
      if (!data.companies || Object.keys(data.companies).length === 0) {
        logger.warn('No companies found in database');
        return [];
      }
      
      // Extract only the ID values
      const companyIds = Object.keys(data.companies);
      logger.info(`Retrieved ${companyIds.length} company IDs from database`);
      
      return companyIds;
    } catch (error) {
      logger.error(`Failed to get company IDs: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Fetch company information from SQL Server for a given company ID
   * This retrieves data from the cached single-query results
   * 
   * @param {string} companyId - Company ID to fetch information for
   * @returns {Promise<Object>} Company information
   */
  async getCompanyInfo(companyId) {
    try {
      // Get data from the optimized single-query approach
      const data = await this.getAllCompaniesWithEmployees();
      
      if (data.companies && data.companies[companyId]) {
        return data.companies[companyId];
      }
      
      logger.warn(`No company found with ID: ${companyId}`);
      return null;
    } catch (error) {
      logger.error(`Failed to get company info for ${companyId}: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Get detailed company information from database
   * Formats the company info into a standardized response structure
   * 
   * @param {string} companyId - Company ID to get information for
   * @returns {Promise<Object>} Company information
   */
  async getCompanyDetails(companyId) {
    try {
      const companyInfo = await this.getCompanyInfo(companyId);
      
      if (!companyInfo) {
        logger.warn(`No details found for company ID: ${companyId}`);
        return null;
      }
      
      // Return company details in the same format as the API service would
      return {
        id: companyInfo.CompanyId,
        name: companyInfo.CompanyName,
        storeNumber: companyInfo.CompanyCode || companyInfo.CompanyId,
        address: companyInfo.Address || companyInfo.Address1,
        city: companyInfo.City,
        state: companyInfo.State,
        zipCode: companyInfo.ZipCode,
        phoneNumber: companyInfo.PhoneNumber || (companyInfo.AreaCode + companyInfo.Phone),
        active: companyInfo.Active === 1 || companyInfo.Active === true
      };
    } catch (error) {
      logger.error(`Failed to get details for company ${companyId}: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Fetch employee records from SQL Server for a given company ID
   * Uses the optimized single-query approach with cached data
   * 
   * @param {string} companyId - Company ID to fetch employees for
   * @returns {Promise<Object[]>} List of employee records
   */
  async getEmployeeRecords(companyId) {
    try {
      // Get data from the optimized single-query approach
      const data = await this.getAllCompaniesWithEmployees();
      
      const employees = data.employeesByCompany && data.employeesByCompany[companyId] 
        ? data.employeesByCompany[companyId] 
        : [];
        
      logger.info(`Retrieved ${employees.length} employee records for company ${companyId}`);
      return employees;
    } catch (error) {
      logger.error(`Failed to get employee records for company ${companyId}: ${error.message}`, { error });
      throw error;
    }
  }


  /**
   * Fetch all companies with their employees in a single query
   * 
   * @returns {Promise<Object>} Object with companies and employees by company ID
   */
  async getAllCompaniesWithEmployees() {
    try {
      // Check if we already have the data cached
      if (this._companiesWithEmployeesCache && 
          Date.now() - this._companiesWithEmployeesCacheTime < this._cacheExpiration) {
        logger.debug('Using cached companies with employees data');
        return this._companiesWithEmployeesCache;
      }

      // The query joins the company and employee tables to get all data at once
      //TODO: Use correct claim name for Infor identification
      const query = `
        SELECT 
            -- Company fields
            C.CompanyId,
            C.Company_Cd AS CompanyCode,
            RTRIM(C.Company_Nm) AS CompanyName,
            
            -- Employee fields
            PM.Employee_Cd AS UserId,
            PH.Status_Cd AS Status,
            PMISC.Personal_EMail_Txt AS Email,
            PM.First_Name_Txt AS FirstName,
            PM.Last_Name_Txt AS LastName,
            PH.OriginalHire_Dt AS HireDate,
            PH.Termination_Dt AS TermDate,
            PA.Home_AreaCode_Txt + PA.Home_Phone_Txt AS PhoneNumber,
            PM.Birth_Dt AS DateofBirth,
            PM.Ssn_Nbr AS SSN,
            PPD.UnitRate_Amt AS PayRate,
            PH.Job_Cd AS JobCode,                   
            PU.UserDefined1_Txt AS PrimaryJob,
            (
                SELECT MAX(LastUpdated) FROM (VALUES
                    (PM.LastUpdated_Dt),
                    (PH.LastUpdated_Dt),
                    (PA.LastUpdated_Dt),
                    (PPD.LastUpdated_Dt),
                    (PMISC.LastUpdated_Dt),
                    (PU.LastUpdated_Dt)
                ) AS AllDates(LastUpdated)
            ) AS LastUpdated
        FROM 
            HRPremier.dbo.Company C
        INNER JOIN 
            HRPremier.dbo.CompanyClaims CC ON C.Company_Cd = CC.CompanyCode
        INNER JOIN 
            HRPremier.dbo.CompanyClaimReference CCR ON CC.CompanyClaimReferenceId = CCR.CompanyClaimReferenceId
        -- Left join to include companies even if they have no employees
        INNER JOIN HRPremier.dbo.Person_Main PM ON PM.Company_Cd = C.Company_Cd
        LEFT JOIN HRPremier.dbo.Person_Hire PH ON PH.Employee_Cd = PM.Employee_Cd
        LEFT JOIN HRPremier.dbo.Person_Address PA ON PA.Employee_Cd = PM.Employee_Cd
        LEFT JOIN HRPremier.dbo.Person_PayrollDemographics PPD ON PPD.Employee_Cd = PM.Employee_Cd
        LEFT JOIN HRPremier.dbo.Person_Miscellaneous PMISC ON PMISC.Employee_Cd = PM.Employee_Cd 
        LEFT JOIN HRPremier.dbo.Person_UserDefined PU ON PU.Employee_Cd = PM.Employee_Cd
        WHERE CCR.ClaimName = 'AzureB2C' 
        AND (
            SELECT MAX(LastUpdated) FROM (VALUES
                (PM.LastUpdated_Dt),
                (PH.LastUpdated_Dt),
                (PA.LastUpdated_Dt),
                (PPD.LastUpdated_Dt),
                (PMISC.LastUpdated_Dt),
                (PU.LastUpdated_Dt)
            ) AS AllDates(LastUpdated)
        ) >= DATEADD(day, -1, GETDATE())
        ORDER BY 
            C.Company_Nm, PM.Last_Name_Txt, PM.First_Name_Txt
      `;
      
      const results = await this.executeQuery(query);
      logger.info(`Retrieved data for ${results.length} company-employee records in a single query`);
      
      // Process the results to group employees by company
      const companies = {};
      const employeesByCompany = {};
      
      results.forEach(row => {
        const companyId = row.CompanyId;
        
        // Store company data if we haven't seen this company before
        if (!companies[companyId]) {
          companies[companyId] = {
            CompanyId: row.CompanyId,
            CompanyCode: row.CompanyCode,
            CompanyName: row.CompanyName,
            FederalId: row.FederalId,
            Address1: row.Address1,
            City: row.City,
            State: row.State,
            ZipCode: row.ZipCode,
            AreaCode: row.AreaCode,
            Phone: row.Phone,
            Address: row.Address,
            Active: row.Active,
            Claim: row.Claim
          };
          
          // Initialize empty employee array for this company
          employeesByCompany[companyId] = [];
        }
        
        // Add employee data if this row has an employee
        if (row.UserId) {
          employeesByCompany[companyId].push({
            UserId: row.UserId,
            Status: row.Status,
            Email: row.Email,
            FirstName: row.FirstName,
            LastName: row.LastName,
            HireDate: row.HireDate,
            TermDate: row.TermDate,
            PhoneNumber: row.PhoneNumber,
            DateofBirth: row.DateofBirth,
            SSN: row.SSN,
            PayRate: row.PayRate,
            JobCode: row.JobCode,
            PrimaryJob: row.PrimaryJob,
            companyId: companyId
          });
        }
      });
      
      // Create the result object
      const result = {
        companies,
        employeesByCompany
      };
      
      // Cache the results for future use
      this._companiesWithEmployeesCache = result;
      this._companiesWithEmployeesCacheTime = Date.now();
      
      // Log some stats
      const companyCount = Object.keys(companies).length;
      const totalEmployees = Object.values(employeesByCompany).reduce((total, emps) => total + emps.length, 0);
      logger.info(`Processed data for ${companyCount} companies with ${totalEmployees} total employees`);
      
      return result;
    } catch (error) {
      logger.error(`Failed to get companies with employees: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Get all employees for all companies in a single query
   * 
   * @returns {Promise<Object>} Object with companies and all employees
   */
  async getAllEmployees() {
    try {
      const data = await this.getAllCompaniesWithEmployees();
      
      // Flatten the employees array
      const allEmployees = [];
      Object.entries(data.employeesByCompany).forEach(([companyId, employees]) => {
        allEmployees.push(...employees);
      });
      
      logger.info(`Retrieved ${allEmployees.length} total employees`);
      return {
        companies: data.companies,
        employees: allEmployees
      };
    } catch (error) {
      logger.error(`Failed to get all employees: ${error.message}`, { error });
      throw error;
    }
  }
}

/**
 * Example usage of the DatabaseService:
 * 
 * // To process all companies with the optimized single-query approach:
 * async function processAllCompaniesOptimized() {
 *   // Get all companies with their employees in a single query
 *   const data = await databaseService.getAllCompaniesWithEmployees();
 *   
 *   // Process each company and its employees from the cached data
 *   for (const [companyId, companyInfo] of Object.entries(data.companies)) {
 *     const employees = data.employeesByCompany[companyId] || [];
 *     
 *     // Work with the company and its employees without additional database calls
 *     console.log(`Processing ${employees.length} employees for company ${companyInfo.CompanyName}`);
 *     
 *     // Process company data and its employees...
 *   }
 * }
 */

// Export singleton instance
module.exports = new DatabaseService();
