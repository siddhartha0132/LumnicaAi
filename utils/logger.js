const config = require('../config');

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_NAMES = {
  0: 'DEBUG',
  1: 'INFO',
  2: 'WARN',
  3: 'ERROR',
};

const currentLevel = LOG_LEVELS[config.logging.level] || 1;

const logger = {
  debug(message, data) {
    if (LOG_LEVELS.debug >= currentLevel) {
      console.log(
        `[${new Date().toISOString()}] [DEBUG] ${message}`,
        data ? JSON.stringify(data) : ''
      );
    }
  },

  info(message, data) {
    if (LOG_LEVELS.info >= currentLevel) {
      console.log(
        `[${new Date().toISOString()}] [INFO] ${message}`,
        data ? JSON.stringify(data) : ''
      );
    }
  },

  warn(message, data) {
    if (LOG_LEVELS.warn >= currentLevel) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ${message}`,
        data ? JSON.stringify(data) : ''
      );
    }
  },

  error(message, data) {
    if (LOG_LEVELS.error >= currentLevel) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] ${message}`,
        data ? JSON.stringify(data) : ''
      );
    }
  },
};

module.exports = logger;
const config = require('../config');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const logLevel = levels[config.logging.level] ?? levels.info;

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

const logger = {
  error(message, meta = {}) {
    if (logLevel >= levels.error) {
      console.error(formatMessage('error', message, meta));
    }
  },

  warn(message, meta = {}) {
    if (logLevel >= levels.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  info(message, meta = {}) {
    if (logLevel >= levels.info) {
      console.log(formatMessage('info', message, meta));
    }
  },

  debug(message, meta = {}) {
    if (logLevel >= levels.debug) {
      console.log(formatMessage('debug', message, meta));
    }
  },
};

module.exports = logger;