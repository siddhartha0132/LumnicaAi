const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { getSkinAnalysisPrompt } = require('../prompts/skinAnalysisPrompt');

const BASE_URL = 'https://integrate.api.nvidia.com/v1';

const nvidiaService = {
  isConfigured() {
    // Text model (quiz generation, result analysis)
    return Boolean(
      config.providers.nvidia.apiKeyText &&
      config.providers.nvidia.model
    );
  },

  isVisionConfigured() {
    // Vision model (skin image analysis)
    return Boolean(
      config.providers.nvidia.apiKeyVision &&
      config.providers.nvidia.visionModel
    );
  },

  extractJSON(text) {
    // Strip markdown code fences
    let cleaned = text
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
      // Last resort: try to fix common issues like trailing commas
      try {
        const fixed = jsonStr.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(fixed);
      } catch {
        throw new AppError(`Failed to parse AI JSON: ${err.message}. Raw: ${text.substring(0, 200)}`, 500);
      }
    }
  },

  /**
   * Text chat — uses primary text model + apiKeyText
   * Model: meta/llama-4-maverick-17b-128e-instruct
   */
  async chat(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new AppError('NVIDIA NIM not configured — set NVIDIA_API_KEY_TEXT in env', 500);
    }

    const { model, apiKeyText, baseUrl, temperature, maxTokens } = config.providers.nvidia;
    const modelName = options.model || model;
    const temp = options.temperature ?? temperature;
    const maxTok = options.maxTokens ?? maxTokens;
    const endpoint = `${baseUrl || BASE_URL}/chat/completions`;

    logger.debug(`[NVIDIA Text] POST ${endpoint}`, { model: modelName });

    try {
      const response = await axios.post(endpoint, {
        model: modelName,
        messages,
        temperature: temp,
        max_tokens: maxTok,
        top_p: options.topP ?? 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        stream: false,
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKeyText}`,
        },
        timeout: 60000,
      });

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new AppError('NVIDIA text model returned empty response', 500);
      }

      return content;
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data?.detail || err.response.data?.error?.message || JSON.stringify(err.response.data);
        logger.error(`[NVIDIA Text] API error ${status}: ${data}`);
        throw new AppError(`NVIDIA Text error (${status}): ${data}`, 500);
      }
      throw new AppError(`NVIDIA Text request failed: ${err.message}`, 500);
    }
  },

  /**
   * Vision analysis — tries primary 90B vision model first,
   * then falls back to nano 8B if primary fails.
   * Model 1: meta/llama-3.2-90b-vision-instruct   (apiKeyVision)
   * Model 2: nvidia/llama-3.1-nemotron-nano-vl-8b-v1 (apiKeyVisionFallback)
   */
  async analyzeSkinFromImage(imageBase64, mimeType) {
    if (!this.isVisionConfigured()) {
      throw new AppError('NVIDIA NIM not configured — set NVIDIA_API_KEY_VISION in env', 500);
    }

    const { visionModel, visionFallbackModel, apiKeyVision, apiKeyVisionFallback, baseUrl } = config.providers.nvidia;
    const endpoint = `${baseUrl || BASE_URL}/chat/completions`;
    const prompt = getSkinAnalysisPrompt();

    const buildMessages = () => ([
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
        ],
      },
    ]);

    const callVision = async (model, apiKey, label) => {
      logger.debug(`[NVIDIA Vision] ${label} | POST ${endpoint}`, { model });
      console.log(`[NVIDIA Vision] ${label} | model=${model} | mime=${mimeType}`);

      const response = await axios.post(endpoint, {
        model,
        messages: buildMessages(),
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 1024,
        stream: false,
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 120000,
      });

      const message = response.data.choices?.[0]?.message;
      const content = message?.content;
      if (!content) {
        throw new AppError(`${label} returned empty response`, 500);
      }

      console.log(`[NVIDIA Vision] ${label} raw (first 500):`, content.substring(0, 500));
      return content;
    };

    let content;
    try {
      content = await callVision(visionModel, apiKeyVision, 'PRIMARY 90B');
    } catch (primaryErr) {
      console.warn(`[NVIDIA Vision] Primary 90B failed (${primaryErr.message}), trying nano 8B fallback...`);
      try {
        content = await callVision(visionFallbackModel, apiKeyVisionFallback, 'FALLBACK 8B');
      } catch (fallbackErr) {
        if (fallbackErr.response) {
          const status = fallbackErr.response.status;
          const data = fallbackErr.response.data?.detail || fallbackErr.response.data?.error?.message || JSON.stringify(fallbackErr.response.data);
          logger.error(`[NVIDIA Vision] Fallback also failed ${status}: ${data}`);
          throw new AppError(`NVIDIA Vision both models failed. Last error (${status}): ${data}`, 500);
        }
        throw new AppError(`NVIDIA Vision fallback failed: ${fallbackErr.message}`, 500);
      }
    }

    const parsed = this.extractJSON(content);
    const inner = parsed.skinData || parsed;
    const imageConfidence = parsed.imageConfidence || 'unknown';

    console.log('[NVIDIA Vision] imageConfidence:', imageConfidence);
    return { inner, imageConfidence };
  },

  /**
   * Analyze quiz answers + skin data → Ayurvedic routine
   * Uses text model (meta/llama-4-maverick-17b-128e-instruct)
   */
  async analyzeResults(skinData, answers) {
    const answerText = answers.map((a, i) => `Q${i + 1}: ${a}`).join(' | ');

    const tone = skinData.tone || 'unknown';
    const fitzpatrick = skinData.fitzpatrickType || skinData.fitzpatrick?.type || 'unknown';
    const hex = skinData.approximateHex || skinData.fitzpatrick?.hexRange || 'unknown';
    const oiliness = skinData.oiliness || 'unknown';
    const texture = skinData.texture || 'unknown';
    const undertone = skinData.undertone || skinData.fitzpatrick?.undertone || 'unknown';

    let concerns = 'none';
    if (Array.isArray(skinData.concerns)) {
      concerns = skinData.concerns.join(', ');
    }

    const prompt = `You are an expert Ayurvedic dermatologist. Analyze this DETAILED skin profile and quiz answers to provide a personalized Ayurvedic skincare recommendation.

DETAILED SKIN PROFILE:
- Skin Tone: ${tone}
- Fitzpatrick Type: ${fitzpatrick}
- Hex Color: ${hex}
- Oiliness: ${oiliness}
- Texture: ${texture}
- Concerns: ${concerns}
- Undertone: ${undertone}

QUIZ ANSWERS: ${answerText}

Return a valid JSON object ONLY (no markdown, no text outside JSON):
{
  "dosha": {
    "type": "Pitta-Kapha",
    "description": "Your constitution combines..."
  },
  "skinProfile": {
    "tone": "${tone}",
    "type": "${oiliness}",
    "concerns": ${JSON.stringify(concerns.split(', '))},
    "undertone": "${undertone}"
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

  /**
   * Generate skin quiz questions based on image analysis data
   * Uses text model (meta/llama-4-maverick-17b-128e-instruct)
   */
  async generateQuizQuestions(skinData) {
    const tone = skinData.tone || 'unknown';
    const fitzpatrick = skinData.fitzpatrickType || skinData.fitzpatrick?.type || 'unknown';
    const hex = skinData.approximateHex || skinData.fitzpatrick?.hexRange || 'unknown';
    const oiliness = skinData.oiliness || 'unknown';
    const texture = skinData.texture || 'unknown';
    const undertone = skinData.undertone || skinData.fitzpatrick?.undertone || 'unknown';

    let concerns = 'none';
    if (Array.isArray(skinData.concerns)) {
      concerns = skinData.concerns.join(', ');
    }

    const prompt = `You are an Ayurvedic skin expert. Based on this person's DETAILED skin analysis, generate 5 highly personalized quiz questions to determine their Ayurvedic dosha and create a tailored skincare routine.

DETAILED SKIN ANALYSIS:
- Skin Tone: ${tone}
- Fitzpatrick Type: ${fitzpatrick}
- Hex Color: ${hex}
- Oiliness: ${oiliness}
- Texture: ${texture}
- Undertone: ${undertone}
- Concerns: ${concerns}

Generate 5 questions HIGHLY SPECIFIC to their actual concerns (${concerns}) and skin type (${oiliness}, ${texture}).
Each question must have exactly 4 options. Focus on skincare habits, environmental factors, lifestyle, and how they currently manage their specific concerns.

Return ONLY valid JSON, no markdown:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"]
    }
  ]
}`;

    const response = await this.chat([{ role: 'user', content: prompt }], {
      temperature: 1.0,
      maxTokens: 1024,
    });
    return this.extractJSON(response);
  },
};

module.exports = nvidiaService;
