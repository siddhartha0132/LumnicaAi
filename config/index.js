require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',

  server: {
    port: parseInt(process.env.PORT, 10) || 5000,
    host: process.env.HOST || '0.0.0.0',
  },

  providers: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    },
    nvidia: {
      apiKey: process.env.NVIDIA_API_KEY,
      baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      model: process.env.NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct',
      temperature: parseFloat(process.env.NVIDIA_TEMPERATURE) || 0.5,
      maxTokens: parseInt(process.env.NVIDIA_MAX_TOKENS) || 2048,
    },
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    skipHealthCheck: process.env.RATE_LIMIT_SKIP_HEALTH === 'true',
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  ml: {
    confidenceThreshold: parseFloat(process.env.ML_CONFIDENCE_THRESHOLD) || 0.75,
    skinDetectionThreshold: parseFloat(process.env.SKIN_DETECTION_THRESHOLD) || 0.15,
    fallbackToGemini: process.env.ML_FALLBACK_TO_GEMINI !== 'false',
  },

  demo: {
    enabled: process.env.DEMO_MODE === 'true',
  },

  products: {
    suggestProducts: process.env.SUGGEST_PRODUCTS !== 'false',
  },

  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
};
require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',

  server: {
    port: parseInt(process.env.PORT, 10) || 5000,
    host: process.env.HOST || '0.0.0.0',
  },

  providers: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    },
    nvidia: {
      apiKey: process.env.NVIDIA_API_KEY,
      baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      model: process.env.NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct',
      temperature: parseFloat(process.env.NVIDIA_TEMPERATURE) || 0.5,
      maxTokens: parseInt(process.env.NVIDIA_MAX_TOKENS) || 2048,
    },
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    skipHealthCheck: process.env.RATE_LIMIT_SKIP_HEALTH === 'true',
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  ml: {
    confidenceThreshold: parseFloat(process.env.ML_CONFIDENCE_THRESHOLD) || 0.75,
    skinDetectionThreshold: parseFloat(process.env.SKIN_DETECTION_THRESHOLD) || 0.15,
    fallbackToGemini: process.env.ML_FALLBACK_TO_GEMINI !== 'false',
  },

  demo: {
    enabled: process.env.DEMO_MODE === 'true',
  },

  products: {
    suggestProducts: process.env.SUGGEST_PRODUCTS !== 'false',
  },

  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
};