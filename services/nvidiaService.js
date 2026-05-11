const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const nvidiaService = {
  isConfigured() {
    return Boolean(
      config.providers.nvidia.apiKey &&
      config.providers.nvidia.apiKey !== 'your_nvidia_api_key_here' &&
      config.providers.nvidia.model
    );
  },

  extractJSON(text) {
    const stripped = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .replace(/^[^{[]+/, '')
      .trim();

    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AppError('AI response did not contain valid JSON', 500);
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      throw new AppError(`Failed to parse AI JSON response: ${err.message}`, 500);
    }
  },

  async chat(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new AppError('NVIDIA NIM not configured — set NVIDIA_API_KEY in env', 500);
    }

    const { model, baseUrl, temperature, maxTokens } = config.providers.nvidia;
    const modelName = options.model || model;
    const temp = options.temperature ?? temperature;
    const maxTok = options.maxTokens ?? maxTokens;

    // NVIDIA NIM uses /v1/chat/completions (not /chat/completions)
    const endpoint = `${baseUrl}/chat/completions`;
    logger.debug(`[NVIDIA] POST ${endpoint}`, { model: modelName });

    try {
      const response = await axios.post(endpoint, {
        model: modelName,
        messages,
        temperature: temp,
        max_tokens: maxTok,
        top_p: options.topP ?? 0.95,
        stream: false,
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.providers.nvidia.apiKey}`,
        },
        timeout: 60000,
      });

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new AppError('NVIDIA returned empty response', 500);
      }

      return content;
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data?.detail || err.response.data?.error?.message || JSON.stringify(err.response.data);
        logger.error(`[NVIDIA] API error ${status}: ${data}`);
        throw new AppError(`NVIDIA error (${status}): ${data}`, status >= 400 && status < 500 ? 502 : 500);
      }
      throw new AppError(`NVIDIA request failed: ${err.message}`, 500);
    }
  },

  async analyzeResults(skinData, answers) {
    const answerText = answers.map((a, i) => `Q${i + 1}: ${a}`).join(' | ');

    const prompt = `You are an expert Ayurvedic dermatologist. Analyze this skin profile and quiz answers to provide a personalized Ayurvedic skincare recommendation.

SKIN PROFILE:
- Tone: ${skinData.tone || skinData.approximateHex || 'unknown'}
- Fitzpatrick Type: ${skinData.fitzpatrickType || 'unknown'}
- Oiliness: ${skinData.oiliness || 'unknown'}
- Texture: ${skinData.texture || 'unknown'}
- Concerns: ${Array.isArray(skinData.concerns) ? skinData.concerns.join(', ') : skinData.concerns || 'none'}
- Undertone: ${skinData.undertone || 'unknown'}

QUIZ ANSWERS: ${answerText}

Return a valid JSON object ONLY (no markdown, no text outside JSON):
{
  "dosha": {
    "type": "Pitta-Kapha",
    "description": "Your constitution combines..."
  },
  "skinProfile": {
    "tone": "medium warm",
    "type": "combination",
    "concerns": ["acne", "dark spots"],
    "undertone": "warm golden"
  },
  "routine": {
    "morning": [
      { "step": "Cleanse", "product": "Neem Face Wash", "reason": "why it works" }
    ],
    "night": [
      { "step": "Double Cleanse", "product": "Coconut Oil", "reason": "why it works" }
    ],
    "weekly": [
      { "step": "Face Mask", "product": "Multani Mitti", "reason": "why it works" }
    ]
  },
  "products": [
    { "name": "Product Name", "price": 299, "benefit": "Key benefit" }
  ],
  "doshaInsights": "Lifestyle and dietary advice..."
}`;

    const response = await this.chat([{ role: 'user', content: prompt }]);
    const result = this.extractJSON(response);

    if (!result.dosha || !result.routine) {
      throw new AppError('Invalid NVIDIA response structure — missing dosha or routine', 500);
    }

    return result;
  },
};

module.exports = nvidiaService;
