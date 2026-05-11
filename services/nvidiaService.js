const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { getSkinAnalysisPrompt } = require('../prompts/skinAnalysisPrompt');

// Vision model for image analysis (multimodal)
const VISION_MODEL = process.env.NVIDIA_VISION_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

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

    let jsonStr = stripped.match(/\{[\s\S]*\}/)?.[0] || stripped;
    
    // Remove C-style comments (/* ... */ and // ...)
    jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    if (!jsonStr.trim().startsWith('{') && !jsonStr.trim().startsWith('[')) {
      throw new AppError('AI response did not contain valid JSON', 500);
    }

    try {
      return JSON.parse(jsonStr);
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

    // Extract all available data
    const tone = skinData.tone || skinData.approximateHex || 'unknown';
    const fitzpatrick = skinData.fitzpatrickType || skinData.fitzpatrick?.type || 'unknown';
    const hex = skinData.approximateHex || skinData.fitzpatrick?.hexRange || 'unknown';
    const oiliness = skinData.oiliness || skinData.oiliness?.overall || 'unknown';
    const texture = skinData.texture || skinData.texture?.overall || 'unknown';
    const undertone = skinData.undertone || skinData.fitzpatrick?.undertone || 'unknown';
    
    let concerns = 'none';
    if (Array.isArray(skinData.concerns)) {
      concerns = skinData.concerns.join(', ');
    } else if (skinData.concerns && Array.isArray(skinData.concerns)) {
      concerns = skinData.concerns.map(c => c.name || c).join(', ');
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
   * Analyzes a skin image using NVIDIA Nemotron Omni (multimodal vision model).
   * Sends the image as base64 inline data via OpenAI-compatible chat format.
   */
  async analyzeSkinFromImage(imageBase64, mimeType) {
    if (!this.isConfigured()) {
      throw new AppError('NVIDIA NIM not configured — set NVIDIA_API_KEY in env', 500);
    }

    const prompt = getSkinAnalysisPrompt();
    const endpoint = `${config.providers.nvidia.baseUrl}/chat/completions`;

    logger.debug(`[NVIDIA Vision] POST ${endpoint}`, { model: VISION_MODEL });
    console.log(`[NVIDIA Vision] Analyzing image | model=${VISION_MODEL} | mime=${mimeType}`);

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ];

    try {
      const response = await axios.post(endpoint, {
        model: VISION_MODEL,
        messages,
        temperature: 0.6,
        top_p: 0.95,
        max_tokens: 8192,
        stream: false,
        extra_body: {
          chat_template_kwargs: { enable_thinking: true },
          reasoning_budget: 4096,
        },
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.providers.nvidia.apiKey}`,
        },
        timeout: 120000, // 2 min — reasoning models take longer
      });

      const message = response.data.choices?.[0]?.message;
      const content = message?.content || message?.reasoning_content;
      if (!content) {
        throw new AppError('NVIDIA Vision returned empty response', 500);
      }

      console.log('[NVIDIA Vision] Raw response (first 600 chars):', content.substring(0, 600));

      const parsed = this.extractJSON(content);

      // ANTI_GRAVITY_PROMPT returns { skinData: {...}, imageConfidence: '...' }
      // Unwrap if nested, fall back to flat
      const inner = parsed.skinData || parsed;
      const imageConfidence = parsed.imageConfidence || 'unknown';

      console.log('[NVIDIA Vision] imageConfidence:', imageConfidence);
      return { inner, imageConfidence };

    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data?.detail || err.response.data?.error?.message || JSON.stringify(err.response.data);
        logger.error(`[NVIDIA Vision] API error ${status}: ${data}`);
        throw new AppError(`NVIDIA Vision error (${status}): ${data}`, 500);
      }
      throw new AppError(`NVIDIA Vision request failed: ${err.message}`, 500);
    }
  },

  async generateQuizQuestions(skinData) {
    // Extract all available data
    const tone = skinData.tone || 'unknown';
    const fitzpatrick = skinData.fitzpatrickType || skinData.fitzpatrick?.type || 'unknown';
    const hex = skinData.approximateHex || skinData.fitzpatrick?.hexRange || 'unknown';
    const oiliness = skinData.oiliness || skinData.oiliness?.overall || 'unknown';
    const texture = skinData.texture || skinData.texture?.overall || 'unknown';
    const undertone = skinData.undertone || skinData.fitzpatrick?.undertone || 'unknown';
    
    let concerns = 'none';
    if (Array.isArray(skinData.concerns)) {
      concerns = skinData.concerns.join(', ');
    } else if (skinData.concerns && Array.isArray(skinData.concerns)) {
      concerns = skinData.concerns.map(c => c.name || c).join(', ');
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

Generate 5 questions that are HIGHLY SPECIFIC to their actual concerns (${concerns}) and skin type (${oiliness}, ${texture}). 

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
      temperature: 0.6,
      maxTokens: 1024,
    });
    return this.extractJSON(response);
  },
};

module.exports = nvidiaService;
