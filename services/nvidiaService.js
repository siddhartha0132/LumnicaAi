const axios = require('axios');
const sharp = require('sharp');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { getSkinAnalysisPrompt } = require('../prompts/skinAnalysisPrompt');

const BASE_URL = 'https://integrate.api.nvidia.com/v1';

const nvidiaService = {
  isConfigured() {
    return Boolean(config.providers.nvidia.apiKey && config.providers.nvidia.model);
  },

  isVisionConfigured() {
    return this.isConfigured();
  },

  extractJSON(text) {
    // Strip markdown code fences and <think> reasoning blocks
    let cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    // Try to find a JSON object anywhere in the response
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objMatch) {
      throw new AppError(`AI response did not contain valid JSON. Raw: ${text.substring(0, 200)}`, 500);
    }

    let jsonStr = objMatch[0];

    // Remove C-style comments
    jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    try {
      return JSON.parse(jsonStr);
    } catch (err) {
      // Last resort: fix trailing commas
      try {
        const fixed = jsonStr.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(fixed);
      } catch {
        throw new AppError(`Failed to parse AI JSON: ${err.message}. Raw: ${text.substring(0, 200)}`, 500);
      }
    }
  },

  /**
   * Core API call. Only image analysis uses NVIDIA now; the quiz and results
   * are rule-based (see services/doshaService.js).
   * Model: nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
   * MoE: 30B total params, only 3B active → fast despite size.
   */
  async _call(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new AppError('NVIDIA NIM not configured — set NVIDIA_API_KEY in env', 500);
    }

    const { model, apiKey, baseUrl, temperature, maxTokens, reasoningBudget } = config.providers.nvidia;
    const endpoint = `${baseUrl || BASE_URL}/chat/completions`;
    const temp = options.temperature ?? temperature;
    const maxTok = options.maxTokens ?? maxTokens;

    logger.debug(`[NVIDIA] POST ${endpoint}`, { model });

    const body = {
      model,
      messages,
      temperature: temp,
      max_tokens: maxTok,
      top_p: options.topP ?? 0.95,
      reasoning_budget: options.reasoningBudget ?? reasoningBudget,
      stream: false,
    };

    try {
      const response = await axios.post(endpoint, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: options.timeout ?? 90000,
      });

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new AppError('NVIDIA model returned empty response', 500);
      }

      return content;
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data?.detail || err.response.data?.error?.message || JSON.stringify(err.response.data);
        logger.error(`[NVIDIA] API error ${status}: ${data}`);
        throw new AppError(`NVIDIA error (${status}): ${data}`, 500);
      }
      throw new AppError(`NVIDIA request failed: ${err.message}`, 500);
    }
  },

  /**
   * Vision analysis — compress image, send to omni model.
   * Retries on timeout (`attempts`); visionAnalysis.js passes a short budget when NVIDIA is a fallback.
   */
  async analyzeSkinFromImage(imageBase64, mimeType, { timeout = 90000, attempts = 2 } = {}) {
    if (!this.isConfigured()) {
      throw new AppError('NVIDIA NIM not configured — set NVIDIA_API_KEY in env', 500);
    }

    // Compress image aggressively — smaller payload = faster NIM inference.
    // Target: max 384px on longest side, JPEG q60 → typically <50KB.
    let compressedBase64 = imageBase64;
    let compressedMime = 'image/jpeg';
    try {
      const inputBuffer = Buffer.from(imageBase64, 'base64');
      const originalKB = (inputBuffer.length / 1024).toFixed(1);
      const compressedBuffer = await sharp(inputBuffer)
        .resize({ width: 384, height: 384, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 60 })
        .toBuffer();
      compressedBase64 = compressedBuffer.toString('base64');
      const compressedKB = (compressedBuffer.length / 1024).toFixed(1);
      console.log(`[NVIDIA Vision] Image compressed: ${originalKB}KB → ${compressedKB}KB`);
    } catch (compressErr) {
      console.warn('[NVIDIA Vision] Compression failed, using original:', compressErr.message);
    }

    const prompt = getSkinAnalysisPrompt();
    const { model } = config.providers.nvidia;

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:${compressedMime};base64,${compressedBase64}` },
          },
        ],
      },
    ];

    console.log(`[NVIDIA Vision] model=${model} | mime=${mimeType}`);

    // Retry once on timeout — NIM can be slow under load
    let content;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`[NVIDIA Vision] Attempt ${attempt}/${attempts}...`);
        content = await this._call(messages, { timeout, reasoningBudget: 1024 });
        break;
      } catch (err) {
        const isTimeout = err.message && err.message.includes('timeout');
        if (isTimeout && attempt < attempts) {
          console.warn(`[NVIDIA Vision] Attempt ${attempt} timed out, retrying...`);
          continue;
        }
        throw err;
      }
    }

    console.log(`[NVIDIA Vision] raw (first 500):`, content.substring(0, 500));

    const parsed = this.extractJSON(content);
    const inner = parsed.skinData || parsed;
    const imageConfidence = parsed.imageConfidence || 'unknown';

    console.log('[NVIDIA Vision] imageConfidence:', imageConfidence);
    return { inner, imageConfidence };
  },
};

module.exports = nvidiaService;
