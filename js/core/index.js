import { logger, LogLevel } from './logger.js';
import { errorHandler, safeExecute, safeAsyncExecute } from './errorHandler.js';
import { storageManager } from './storageManager.js';
import { cryptoUtils } from './cryptoUtils.js';

const Core = {
  logger,
  LogLevel,
  errorHandler,
  safeExecute,
  safeAsyncExecute,
  storage: storageManager,
  crypto: cryptoUtils,
  
  async init() {
    await logger.init();
    errorHandler.init();
    
    logger.info('Core modules initialized successfully');
  }
};

export { Core, logger, LogLevel, errorHandler, safeExecute, safeAsyncExecute, storageManager, cryptoUtils };
