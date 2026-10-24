const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const openrouterService = require('./openrouterService');
const nvidiaService = require('./nvidiaService');

/**
 * Server-side photo analysis with a fallback chain: OpenRouter first, then NVIDIA, each with a
 * time limit. If both fail, the request fails fast and the web app falls back to its on-device
 * model, so users are never left waiting on an overloaded service.
 */
async function analyzeImage(imageBase64, mimeType) {
  const providers = [];
  if (openrouterService.isConfigured()) {
    providers.push(['openrouter', () => openrouterService.analyzeSkinFromImage(imageBase64,
      { timeout: config.vision.openrouterTimeoutMs })]);
  }
  if (nvidiaService.isVisionConfigured()) {
    providers.push(['nvidia', () => nvidiaService.analyzeSkinFromImage(imageBase64, mimeType,
      { timeout: config.vision.nvidiaTimeoutMs, attempts: 1 })]);
  }
  if (!providers.length) throw new AppError('No photo analysis provider is configured', 500);

  const failures = [];
  for (const [name, run] of providers) {
    const started = Date.now();
    try {
      const result = await run();
      logger.info('Photo analysis', { provider: name, model: result.model, ms: Date.now() - started });
      return { ...result, provider: result.model ? `${name}:${result.model}` : name };
    } catch (err) {
      logger.warn('Photo analysis provider failed', { provider: name, ms: Date.now() - started, error: err.message });
      failures.push(`${name}: ${err.message}`);
    }
  }
  throw new AppError(`All photo analysis providers failed (${failures.join(' | ')})`, 503);
}

module.exports = { analyzeImage };
