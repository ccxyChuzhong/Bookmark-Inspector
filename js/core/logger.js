const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

class Logger {
  constructor() {
    this.currentLevel = LogLevel.INFO;
    this.logHistory = [];
    this.maxHistorySize = 500;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      const settings = await chrome.storage.local.get('loggerSettings');
      if (settings.loggerSettings) {
        this.currentLevel = settings.loggerSettings.level ?? LogLevel.INFO;
        this.maxHistorySize = settings.loggerSettings.maxHistorySize ?? 500;
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('Logger initialization failed:', error);
    }
  }

  shouldLog(level) {
    return level >= this.currentLevel;
  }

  getLevelName(level) {
    switch (level) {
      case LogLevel.DEBUG: return 'DEBUG';
      case LogLevel.INFO: return 'INFO';
      case LogLevel.WARN: return 'WARN';
      case LogLevel.ERROR: return 'ERROR';
      default: return 'UNKNOWN';
    }
  }

  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const levelName = this.getLevelName(level);
    return {
      timestamp,
      level: levelName,
      levelCode: level,
      message,
      data: data !== undefined ? this.safeStringify(data) : undefined
    };
  }

  safeStringify(obj) {
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return String(obj);
    }
  }

  log(level, message, data) {
    if (!this.shouldLog(level)) return;

    const logEntry = this.formatMessage(level, message, data);
    
    this.logHistory.push(logEntry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    const consoleMethod = level === LogLevel.ERROR ? 'error' : 
                          level === LogLevel.WARN ? 'warn' : 
                          level === LogLevel.DEBUG ? 'debug' : 'log';
    
    console[consoleMethod](`[${logEntry.timestamp}] [${logEntry.level}] ${message}`, data ?? '');
  }

  debug(message, data) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message, data) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message, data) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message, data) {
    this.log(LogLevel.ERROR, message, data);
  }

  async setLevel(level) {
    this.currentLevel = level;
    try {
      await chrome.storage.local.set({
        loggerSettings: {
          level: this.currentLevel,
          maxHistorySize: this.maxHistorySize
        }
      });
    } catch (error) {
      console.error('Failed to save logger settings:', error);
    }
  }

  getHistory() {
    return [...this.logHistory];
  }

  async exportHistory() {
    const history = this.getHistory();
    return JSON.stringify(history, null, 2);
  }

  clearHistory() {
    this.logHistory = [];
  }
}

const logger = new Logger();
export { logger, LogLevel };
