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
  async analyzeSkinFromImage(imageBase64, { timeout = 20000 } = {}) {
    if (!this.isConfigured()) throw new AppError('OpenRouter not configured: set OPENROUTER_API_KEY', 500);

    const image = await sharp(Buffer.from(imageBase64, 'base64'))
      .rotate()
      .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const { apiKey, models } = config.providers.openrouter;
    const body = {
      models, // OpenRouter falls through this list when a model is busy or erroring
      max_tokens: 1500,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: getSkinAnalysisPrompt() },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` } },
        ],
      }],
    };

    let data;
    try {
      ({ data } = await axios.post(ENDPOINT, body, {
        timeout,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'Lumnica AI' },
      }));
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.error?.message || err.message;
      throw new AppError(`OpenRouter error${status ? ` (${status})` : ''}: ${message}`, 502);
    }

    // Free models sometimes return 200 with an error body and no choices.
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError(`OpenRouter returned no answer: ${data?.error?.message || 'empty response'}`, 502);
    }

    const parsed = extractJSON(content);
    return { inner: parsed.skinData || parsed, imageConfidence: parsed.imageConfidence || 'unknown', model: data.model };
  },
};

module.exports = openrouterService;
