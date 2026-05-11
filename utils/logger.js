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