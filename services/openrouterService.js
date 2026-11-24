const axios = require('axios');
const sharp = require('sharp');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');
const { getSkinAnalysisPrompt } = require('../prompts/skinAnalysisPrompt');
const { extractJSON } = require('./nvidiaService');

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const openrouterService = {
  isConfigured() {
    const { apiKey, models } = config.providers.openrouter;
    return Boolean(apiKey && models.length);
  },

  /**
   * Skin analysis with a vision model on OpenRouter. Same prompt and JSON shape as the NVIDIA
   * service. The image is sent at 768px: general vision models read skin detail better than at
   * the 384px NVIDIA uses.
   */
  async analyzeSkinFromImage(imageBase64, { timeout = 25000 } = {}) {
    if (!this.isConfigured()) throw new AppError('OpenRouter not configured: set OPENROUTER_API_KEY', 500);

    const image = await sharp(Buffer.from(imageBase64, 'base64'))
      .rotate()
      .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const { apiKey, models } = config.providers.openrouter;
    const imageUrl = `data:image/jpeg;base64,${image.toString('base64')}`;
    const deadline = Date.now() + timeout;
    const failures = [];

    // OpenRouter itself skips models that error (busy, rate-limited). A reasoning model can also
    // answer "successfully" with empty content when its thinking uses up the token budget; in that
    // case move on to the next model ourselves, as long as there is time left.
    for (let i = 0; i < models.length; i++) {
      const remaining = deadline - Date.now();
      if (remaining < 3000) break;

      let data;
      try {
        ({ data } = await axios.post(ENDPOINT, {
          models: models.slice(i),
          // Reasoning models spend 500-2000 tokens thinking before the ~200-token JSON answer.
          max_tokens: 4000,
          temperature: 0.2,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: getSkinAnalysisPrompt() },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          }],
        }, {
          timeout: remaining,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'Lumnica AI' },
        }));
      } catch (err) {
        const status = err.response?.status;
        const message = err.response?.data?.error?.message || err.message;
        throw new AppError(`OpenRouter error${status ? ` (${status})` : ''}: ${message}`, 502);
      }

      const choice = data?.choices?.[0];
      const content = choice?.message?.content;
      if (content) {
        const parsed = extractJSON(content);
        return { inner: parsed.skinData || parsed, imageConfidence: parsed.imageConfidence || 'unknown', model: data.model };
      }

      // Free models sometimes return 200 with an error body, or run out of tokens while thinking.
      const answered = models.indexOf(String(data?.model || '').replace(/:free$/, '') + ':free');
      if (answered > i) i = answered;
      failures.push(`${data?.model || models[i]}: ${data?.error?.message || `empty answer (finish: ${choice?.finish_reason || 'none'})`}`);
    }

    throw new AppError(`OpenRouter returned no answer (${failures.join(' | ') || 'out of time'})`, 502);
  },
};

module.exports = openrouterService;
