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
      throw new AppError('NVIDIA NIM is not configured. Set NVIDIA_API_KEY in your .env file.', 500);
    }

    const { model, baseUrl, temperature, maxTokens } = config.providers.nvidia;
    const modelName = options.model || model;
    const temp = options.temperature ?? temperature;
    const maxTok = options.maxTokens ?? maxTokens;

    logger.debug(`[NVIDIA] Chat request`, { model: modelName });

    try {
      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: modelName,
          messages,
          temperature: temp,
          max_tokens: maxTok,
          top_p: options.topP ?? 0.95,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.providers.nvidia.apiKey}`,
          },
          timeout: 60000,
        }
      );

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new AppError('NVIDIA NIM returned empty response', 500);
      }

      logger.debug(`[NVIDIA] Raw response`, { length: content.length });
      return content;
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data?.error?.message || err.response.data?.message || '';
        logger.error(`[NVIDIA] API error ${status}: ${data}`);
        throw new AppError(`NVIDIA NIM error (${status}): ${data}`, status);
      }
      logger.error(`[NVIDIA] Request failed:`, { message: err.message });
      throw new AppError(`NVIDIA NIM request failed: ${err.message}`, 500);
    }
  },

  async generateQuizQuestions(skinData) {
    const prompt = `You are an expert Ayurvedic skincare consultant for LUMNICA AI, a luxury Ayurvedic skincare platform.

Based on the following skin analysis data, generate EXACTLY 5 personalized questions to understand the user's skin better:

Skin Data:
- Tone: ${skinData.tone || 'unknown'}
- Oiliness: ${skinData.oiliness || 'unknown'}
- Texture: ${skinData.texture || 'unknown'}
- Concerns: ${(skinData.concerns || []).join(', ') || 'none'}
- Undertone: ${skinData.undertone || 'unknown'}
- Fitzpatrick Type: ${skinData.fitzpatrickType || 'unknown'}

STRICT REQUIREMENTS:
1. Generate EXACTLY 5 questions
2. Each question must have EXACTLY 4 options (A, B, C, D)
3. Questions should be specific to their skin concerns and dosha determination
4. Use professional, luxury tone
5. Focus on skincare habits, environment, lifestyle, diet, and preferences
6. Include a mix of questions about: skin behavior, lifestyle patterns, dietary preferences, sleep quality, stress levels

OUTPUT FORMAT (STRICT JSON ONLY, NO EXTRA TEXT):
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"]
    }
  ]
}

Generate the questions now:`;

    const response = await this.chat([{ role: 'user', content: prompt }]);
    const result = this.extractJSON(response);

    if (!result.questions || !Array.isArray(result.questions)) {
      throw new AppError('NVIDIA quiz response missing "questions" array', 500);
    }

    return result.questions;
  },

  async analyzeResults(skinData, answers) {
    const prompt = `You are an expert Ayurvedic skincare consultant for LUMNICA AI, a luxury Ayurvedic skincare platform.

Analyze the following data and provide a comprehensive Ayurvedic skincare profile:

SKIN DATA:
- Tone: ${skinData.tone || 'unknown'}
- Oiliness: ${skinData.oiliness || 'unknown'}
- Texture: ${skinData.texture || 'unknown'}
- Concerns: ${(skinData.concerns || []).join(', ') || 'none'}
- Undertone: ${skinData.undertone || 'unknown'}
- Fitzpatrick Type: ${skinData.fitzpatrickType || 'unknown'}

USER ANSWERS (8 questions covering skin behavior, lifestyle, diet, sleep, stress):
${answers.map((ans, idx) => `Q${idx + 1}: ${ans}`).join('\n')}

TASK:
1. Determine the user's Ayurvedic Dosha type (Vata, Pitta, Kapha, or combination like Pitta-Vata, Vata-Kapha, etc.)
2. Create a complete personalized skin profile based on both the skin analysis and dosha constitution
3. Design morning, night, and weekly Ayurvedic skincare routines (5 morning steps, 4 night steps, 2 weekly treatments)
4. Recommend 5-7 products from the available product catalog that match the user's dosha and skin type
5. Provide personalized lifestyle and dietary advice

STRICT OUTPUT FORMAT (JSON ONLY, NO EXTRA TEXT):
{
  "dosha": {
    "type": "Pitta-Vata",
    "description": "Detailed description of this dosha combination and how it manifests in skin"
  },
  "skinProfile": {
    "tone": "medium warm",
    "type": "combination",
    "concerns": ["acne", "dark spots"],
    "undertone": "warm golden"
  },
  "routine": {
    "morning": [
      { "step": "Cleanse", "product": "Product name", "reason": "Why this helps" }
    ],
    "night": [
      { "step": "Cleanse", "product": "Product name", "reason": "Why this helps" }
    ],
    "weekly": [
      { "step": "Mask", "product": "Product name", "reason": "Why this helps" }
    ]
  },
  "products": [
    { "name": "Product Name", "price": 499, "benefit": "Key benefit", "dosha": "Pitta,Vata" }
  ],
  "doshaInsights": "2-3 sentences of personalized Ayurvedic lifestyle advice (diet, sleep, stress, environment)"
}

IMPORTANT: Products must be real Indian Ayurvedic skincare products with realistic prices between ₹149-₹1999.
Provide the analysis now:`;

    const response = await this.chat([{ role: 'user', content: prompt }]);
    const result = this.extractJSON(response);

    if (!result.dosha || !result.routine || !result.products) {
      throw new AppError('NVIDIA analysis response missing required fields', 500);
    }

    return result;
  },

  async analyzeSkinFromImage(imageBase64, mimeType, skinAnalysisPrompt) {
    const prompt = skinAnalysisPrompt || `You are a clinical-grade AI dermatologist for LUMNICA AI.

TASK: Carefully examine the uploaded facial photo and perform a highly accurate, INDIVIDUALIZED skin analysis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — SKIN TONE (Fitzpatrick Scale)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Map the skin color to Fitzpatrick phototype (considering diverse Indian skin tones):
- Type I: Very fair/pale white (#FDDBB4) — rare in India
- Type II: Fair/white (#F5CBA7) — occasional in India
- Type III: Medium/beige-white (#E8A87C) — common in North India
- Type IV: Olive/light brown (#C68642) — very common across India
- Type V: Brown/dark brown (#8D5524) — common across India
- Type VI: Deep/very dark brown-black (#4A2912) — common in South India

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — UNDERTONE (using LAB color principles)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyze the warm/cool dimension:
- Positive a + positive b = warm undertone (golden, yellow, peachy)
- Negative a + negative b = cool undertone (pink, rosy, blue)
- Near-zero a and b = neutral
- Moderate positive a and b = olive

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — OILINESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Look for shine on T-zone (forehead, nose) and cheeks:
- T-zone shiny + dry cheeks = combination
- Shiny everywhere = oily
- No shine, possibly tight = dry
- Balanced = normal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — TEXTURE & CONCERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Examine pores, smoothness, visible issues:
- acne, blackheads, whiteheads, dark spots, hyperpigmentation, redness
- enlarged pores, fine lines, dullness, dry patches, uneven tone

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "tone": "medium warm",
  "fitzpatrickType": "IV",
  "approximateHex": "#C68642",
  "oiliness": "combination",
  "texture": "slightly uneven",
  "concerns": ["enlarged pores", "mild acne", "dark spots"],
  "undertone": "warm golden"
}

Analyze the image now and return ONLY valid JSON:`;

    const response = await this.chat([
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: 'high',
            },
          },
        ],
      },
    ]);

    const result = this.extractJSON(response);
    return result;
  },
};

module.exports = nvidiaService;