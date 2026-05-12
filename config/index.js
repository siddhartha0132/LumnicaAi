require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',

  server: {
    port: parseInt(process.env.PORT, 10) || 5000,
    host: process.env.HOST || '0.0.0.0',
  },

  providers: {
    nvidia: {
      // 3 separate API keys, one per model
      apiKeyText:            process.env.NVIDIA_API_KEY_TEXT,
      apiKeyVision:          process.env.NVIDIA_API_KEY_VISION,
      apiKeyVisionFallback:  process.env.NVIDIA_API_KEY_VISION_FALLBACK,

      baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',

      // Primary text model (quiz, results)
      model: process.env.NVIDIA_MODEL || 'meta/llama-4-maverick-17b-128e-instruct',
      // Primary vision model (90B — highest accuracy)
      visionModel: process.env.NVIDIA_VISION_MODEL || 'meta/llama-3.2-90b-vision-instruct',
      // Fallback vision model (8B nano — fast)
      visionFallbackModel: process.env.NVIDIA_VISION_FALLBACK_MODEL || 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',

      temperature: parseFloat(process.env.NVIDIA_TEMPERATURE) || 1.0,
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