import { logger } from './logger.js';

const isServiceWorker = typeof window === 'undefined';
const isExtensionPage = !isServiceWorker && typeof chrome !== 'undefined';

class ErrorHandler {
  constructor() {
    this.isInitialized = false;
    this.errorHandlers = new Map();
    this.errorCounts = new Map();
    this.maxErrorCounts = 10;
  }

  init() {
    if (this.isInitialized) return;

    if (isExtensionPage && typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleWindowError(event);
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.handleUnhandledRejection(event);
      });
    } else if (isServiceWorker && typeof self !== 'undefined') {
      self.addEventListener('error', (event) => {
        this.handleServiceWorkerError(event);
      });

      self.addEventListener('unhandledrejection', (event) => {
        this.handleUnhandledRejection(event);
      });
    }

    this.isInitialized = true;
    logger.info('Error handler initialized');
  }

  handleWindowError(event) {
    const errorInfo = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    };

    const errorKey = `${event.filename}:${event.lineno}:${event.message}`;
    this.incrementErrorCount(errorKey);

    logger.error('Uncaught error:', errorInfo);

    if (this.shouldNotifyUser(errorKey)) {
      this.showUserNotification('发生未捕获的错误', 'error');
    }
  }

  handleServiceWorkerError(event) {
    const errorInfo = {
      message: event.message || event.error?.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    };

    const errorKey = `sw:${event.filename}:${event.lineno}:${event.message}`;
    this.incrementErrorCount(errorKey);

    logger.error('Service Worker uncaught error:', errorInfo);
  }

  handleUnhandledRejection(event) {
    const errorInfo = {
      reason: event.reason?.message || String(event.reason),
      stack: event.reason?.stack
    };

    const errorKey = `unhandled_rejection:${errorInfo.reason}`;
    this.incrementErrorCount(errorKey);

    logger.error('Unhandled promise rejection:', errorInfo);

    if (isExtensionPage && this.shouldNotifyUser(errorKey)) {
      this.showUserNotification('异步操作失败', 'error');
    }
  }

  incrementErrorCount(key) {
    const count = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, count + 1);
  }

  shouldNotifyUser(key) {
    const count = this.errorCounts.get(key) || 0;
    return count <= this.maxErrorCounts;
  }

  wrapAsyncFunction(fn) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, fn.name || 'anonymous_async');
        throw error;
      }
    };
  }

  wrapFunction(fn) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handleError(error, fn.name || 'anonymous');
        throw error;
      }
    };
  }

  handleError(error, context = 'unknown') {
    const errorInfo = {
      context,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    logger.error(`Error in ${context}:`, errorInfo);

    return errorInfo;
  }

  async executeSafely(fn, fallbackValue = null, context = 'unknown') {
    try {
      const result = typeof fn === 'function' ? fn() : fn;
      return result instanceof Promise ? await result : result;
    } catch (error) {
      this.handleError(error, context);
      return fallbackValue;
    }
  }

  showUserNotification(message, type = 'info') {
    if (!isExtensionPage || typeof document === 'undefined') return;

    try {
      const notificationArea = document.querySelector('.notification-area');
      const messageElement = document.getElementById('message');
      
      if (notificationArea && messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type === 'error' ? 'error' : 'success'}`;
        notificationArea.style.display = 'block';

        setTimeout(() => {
          if (notificationArea && messageElement) {
            notificationArea.style.display = 'none';
            messageElement.textContent = '';
            messageElement.className = 'message';
          }
        }, 5000);
      }
    } catch (e) {
      logger.debug('Failed to show user notification:', e.message);
    }
  }

  registerCustomHandler(errorType, handler) {
    this.errorHandlers.set(errorType, handler);
  }

  getErrorStats() {
    return Object.fromEntries(this.errorCounts);
  }

  clearErrorStats() {
    this.errorCounts.clear();
  }
}

const errorHandler = new ErrorHandler();

function safeExecute(fn, fallback = null, context = 'safe_execution') {
  return errorHandler.executeSafely(fn, fallback, context);
}

function safeAsyncExecute(fn, fallback = null, context = 'safe_async_execution') {
  return errorHandler.executeSafely(fn, fallback, context);
}

export { errorHandler, safeExecute, safeAsyncExecute };
