const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const nvidiaService = {
  isConfigured() {
    return Boolean(config.providers.nvidia.apiKey && config.providers.nvidia.model);
  },

  extractJSON(text) {
    const stripped = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .replace(/^[^{]+/, '')
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
      throw new AppError('NVIDIA NIM not configured', 500);
    }

    const { model, baseUrl, temperature, maxTokens } = config.providers.nvidia;
    const modelName = options.model || model;
    const temp = options.temperature ?? temperature;
    const maxTok = options.maxTokens ?? maxTokens;

    logger.debug(`[NVIDIA] Chat request`, { model: modelName });

    try {
      const response = await axios.post(`${baseUrl}/chat/completions`, {
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
        const data = err.response.data?.error?.message || '';
        logger.error(`[NVIDIA] API error ${status}: ${data}`);
        throw new AppError(`NVIDIA error (${status}): ${data}`, status);
      }
      throw new AppError(`NVIDIA request failed: ${err.message}`, 500);
    }
  },

  async analyzeResults(skinData, answers) {
    const answerText = answers.map((a, i) => `Answer ${i + 1}: ${a}`).join(' | ');
    const prompt = `Analyze this skin and provide Ayurvedic skincare profile.
Skin: tone=${skinData.tone}, oiliness=${skinData.oiliness}, texture=${skinData.texture}, concerns=${skinData.concerns}
Answers: ${answerText}
Return JSON: {dosha: {type, description}, skinProfile: {}, routine: {morning, night, weekly}, products: [], doshaInsights}`;

    const response = await this.chat([{ role: 'user', content: prompt }]);
    const result = this.extractJSON(response);

    if (!result.dosha || !result.routine) {
      throw new AppError('Invalid NVIDIA response', 500);
    }

    return result;
  },
};

module.exports = nvidiaService;
