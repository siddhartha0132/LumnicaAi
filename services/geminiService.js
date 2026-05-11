const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const apiKey = config.providers.gemini.apiKey;
if (!apiKey) {
  logger.error('FATAL: GEMINI_API_KEY not configured');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const modelName = config.providers.gemini.model;

function extractJSON(text) {
  const stripped = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AppError('AI response did not contain valid JSON', 500);
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    throw new AppError(`JSON parse failed: ${parseErr.message}`, 500);
  }
}

async function callGemini(prompt) {
  if (!genAI) throw new AppError('GEMINI_API_KEY not configured', 500);

  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return extractJSON(text);
}

async function callGeminiVision(prompt, imageBase64, mimeType) {
  if (!genAI) throw new AppError('GEMINI_API_KEY not configured', 500);

  const model = genAI.getGenerativeModel({ model: modelName });
  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text();

  return extractJSON(text);
}

async function analyzeSkinFromImage(imageBase64, mimeType, skinAnalysisPrompt) {
  const prompt = skinAnalysisPrompt || getSkinAnalysisPrompt();
  return await callGeminiVision(prompt, imageBase64, mimeType);
}

async function analyzeSkinFromImageFallback(imageBase64, mimeType, partialMLData, fallbackPrompt) {
  const prompt = fallbackPrompt || getSkinAnalysisFallbackPrompt(partialMLData);
  return await callGeminiVision(prompt, imageBase64, mimeType);
}

async function generateQuizQuestions(skinData) {
  const prompt = getQuizPrompt(skinData);
  const result = await callGemini(prompt);

  if (!result.questions || !Array.isArray(result.questions)) {
    throw new AppError('Quiz response missing "questions" array', 500);
  }

  return result.questions;
}

async function analyzeResults(skinData, answers) {
  const prompt = getAnalysisPrompt(skinData, answers);
  return await callGemini(prompt);
}

function getSkinAnalysisPrompt() {
  return `You are a clinical-grade AI dermatologist for LUMNICA AI. Analyze the uploaded facial photo for skin properties.

IMPORTANT: Consider diverse Indian skin tones. Most Indians are Fitzpatrick Type III-V.

SKIN TONE (Fitzpatrick Scale - map actual observed color):
- Type I: Very fair/pale (#FDDBB4) — rare in India
- Type II: Fair/white (#F5CBA7) — occasional
- Type III: Medium (#E8A87C) — common in North India
- Type IV: Olive/light brown (#C68642) — very common across India
- Type V: Brown (#8D5524) — common across India
- Type VI: Deep dark (#4A2912) — common in South India

UNDERTONE (from skin's warm/cool dimension):
- Positive a + positive b channels = warm (golden, yellow, peachy)
- Negative a + negative b = cool (pink, rosy, blue)
- Near-zero a/b = neutral
- Moderate positive a and b = olive

OILINESS: combination (T-zone shiny + dry cheeks), oily (shiny everywhere), dry (tight/flaky), normal
TEXTURE: smooth, slightly uneven, uneven, rough
CONCERNS: acne, dark spots, hyperpigmentation, enlarged pores, dullness, redness, fine lines, acne scars

OUTPUT (STRICT JSON ONLY):
{
  "tone": "<descriptive label like 'medium warm', 'deep golden', 'olive warm'>",
  "fitzpatrickType": "<I|II|III|IV|V|VI>",
  "approximateHex": "<hex code>",
  "oiliness": "<dry|normal|oily|combination>",
  "texture": "<smooth|slightly uneven|uneven|rough>",
  "concerns": ["<concern1>", "<concern2>"],
  "undertone": "<warm|cool|neutral|olive>"
}

Analyze the image and return ONLY valid JSON:`;
}

function getSkinAnalysisFallbackPrompt(partialMLData) {
  return `You are a clinical-grade AI dermatologist for LUMNICA AI.

Our on-device ML returned low confidence for this image. Partial data captured:
${JSON.stringify(partialMLData, null, 2)}

Complete and correct the skin assessment. Focus on correcting incomplete fields.

Return ONLY valid JSON:
{
  "tone": "<descriptive label>",
  "fitzpatrickType": "<I|II|III|IV|V|VI>",
  "approximateHex": "<hex code>",
  "oiliness": "<dry|normal|oily|combination>",
  "texture": "<smooth|slightly uneven|uneven|rough>",
  "concerns": ["<concern1>", "<concern2>"],
  "undertone": "<warm|cool|neutral|olive>"
}

Provide the corrected analysis now:`;
}

function getQuizPrompt(skinData) {
  return `You are an expert Ayurvedic skincare consultant for LUMNICA AI.

Based on the following skin analysis, generate EXACTLY 5 personalized questions (4 options each):

Skin Data:
- Tone: ${skinData.tone || 'unknown'}
- Oiliness: ${skinData.oiliness || 'unknown'}
- Texture: ${skinData.texture || 'unknown'}
- Concerns: ${(skinData.concerns || []).join(', ') || 'none'}
- Undertone: ${skinData.undertone || 'unknown'}
- Fitzpatrick Type: ${skinData.fitzpatrickType || 'unknown'}

Requirements:
1. EXACTLY 5 questions, 4 options each
2. Focus on: skin behavior, lifestyle, diet, sleep, stress, environment
3. Professional, luxury tone

OUTPUT (STRICT JSON ONLY):
{
  "questions": [{"question": "text?", "options": ["A", "B", "C", "D"]}]
}

Generate the questions now:`;
}

function getAnalysisPrompt(skinData, answers) {
  return `You are an expert Ayurvedic skincare consultant for LUMNICA AI.

SKIN DATA:
- Tone: ${skinData.tone || 'unknown'}
- Oiliness: ${skinData.oiliness || 'unknown'}
- Texture: ${skinData.texture || 'unknown'}
- Concerns: ${(skinData.concerns || []).join(', ') || 'none'}
- Undertone: ${skinData.undertone || 'unknown'}
- Fitzpatrick: ${skinData.fitzpatrickType || 'unknown'}

USER ANSWERS (8 questions about skin, lifestyle, diet, sleep, stress):
${answers.map((ans, idx) => `Q${idx + 1}: ${ans}`).join('\n')}

TASK:
1. Determine Ayurvedic Dosha type (Vata, Pitta, Kapha or combinations)
2. Create personalized skin profile
3. Design morning (5 steps), night (4 steps), weekly (2 treatments) routines
4. Recommend 5-7 products from our catalog (₹99-₹1999)
5. Provide lifestyle/dietary advice

OUTPUT (STRICT JSON ONLY):
{
  "dosha": { "type": "Pitta-Vata", "description": "description" },
  "skinProfile": { "tone": "medium warm", "type": "combination", "concerns": ["acne"], "undertone": "warm" },
  "routine": {
    "morning": [{"step": "Cleanse", "product": "Product", "reason": "why"}],
    "night": [{"step": "Cleanse", "product": "Product", "reason": "why"}],
    "weekly": [{"step": "Mask", "product": "Product", "reason": "why"}]
  },
  "products": [{"name": "Name", "price": 499, "benefit": "benefit", "dosha": "Vata,Pitta"}],
  "doshaInsights": "lifestyle advice"
}

Provide the analysis now:`;
}

module.exports = {
  analyzeSkinFromImage,
  analyzeSkinFromImageFallback,
  generateQuizQuestions,
  analyzeResults,
  getSkinAnalysisPrompt,
  getSkinAnalysisFallbackPrompt,
  getQuizPrompt,
  getAnalysisPrompt,
};