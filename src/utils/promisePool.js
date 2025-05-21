/**
 * Promise pool utility for controlled concurrency
 */
const logger = require('./logger');

/**
 * Execute an array of promises with limited concurrency
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.concurrency - Maximum number of parallel executions
 * @param {Array<any>} options.items - Array of items to process
 * @param {Function} options.task - Function that returns a promise for each item
 * @returns {Promise<Array<any>>} - Results of all tasks
 */
async function promisePool({ concurrency, items, task }) {
  // Validate inputs
  if (!Array.isArray(items)) {
    throw new Error('Items must be an array');
  }
  
  if (typeof task !== 'function') {
    throw new Error('Task must be a function');
  }
  
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('Concurrency must be a positive integer');
  }
  
  const results = [];
  const executing = new Set();
  const itemCount = items.length;
  
  logger.info(`Starting promise pool with ${itemCount} items and concurrency of ${concurrency}`);
  
  // Create async generator to avoid having to manually manage indices
  async function* generateItemPromises() {
    for (let i = 0; i < itemCount; i++) {
      // Wait until we have capacity to execute more promises
      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
      
      // Yield the next task, wrapped with removal logic
      yield (async function(index) {
        try {
          const promise = task(items[index]);
          executing.add(promise);
          
          // Wait for the promise to complete
          const result = await promise;
          results[index] = result;
          executing.delete(promise);
          logger.debug(`Completed task ${index + 1}/${itemCount}`);
          return result;
        } catch (error) {
          logger.error(`Task ${index + 1}/${itemCount} failed: ${error.message}`, { error });
          results[index] = { 
            success: false, 
            error: error.message 
          };
          throw error;
        }
      })(i);
    }
  }
  
  // Execute tasks with controlled concurrency
  for await (const promise of generateItemPromises()) {
    try {
      await promise;
    } catch (error) {
      // Errors are already handled and results captured above
      // Just continue processing remaining tasks
    }
  }
  
  // Wait for any remaining tasks to complete
  if (executing.size > 0) {
    await Promise.allSettled(executing);
  }
  
  logger.info(`Promise pool completed. Processed ${itemCount} items.`);
  return results;
}

module.exports = { promisePool };
