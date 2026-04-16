const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getQuizPrompt } = require('../prompts/quizPrompt');
const { getAnalysisPrompt } = require('../prompts/analysisPrompt');
const { getSkinAnalysisPrompt } = require('../prompts/skinAnalysisPrompt');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('FATAL: GEMINI_API_KEY not configured! Set it in your .env file.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Using gemini-flash-latest which is the correct model identifier
const MODEL_NAME = 'gemini-flash-latest';

/**
 * Strips markdown fences and extracts the first valid JSON object from a string.
 * Handles cases like:
 *   ```json { ... } ```
 *   Here is the result: { ... }
 */
function extractJSON(text) {
  // Remove markdown fences
  const stripped = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  // Match the outermost { ... } block
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    console.error('No JSON object found in response:\n', text);
    throw new Error('AI response did not contain valid JSON. Raw: ' + text.substring(0, 300));
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    console.error('JSON parse failed. Extracted text:\n', jsonMatch[0]);
    throw new Error('Failed to parse AI JSON response: ' + parseErr.message);
  }
}

async function callGemini(prompt) {
  console.log(`[Gemini] Text call with model: ${MODEL_NAME}`);

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  console.log('[Gemini] Raw text response:\n', text.substring(0, 500));
  return extractJSON(text);
}

async function callGeminiVision(prompt, imageBase64, mimeType) {
  console.log(`[Gemini Vision] Model: ${MODEL_NAME}`);
  console.log(`[Gemini Vision] MIME type: ${mimeType}`);
  console.log(`[Gemini Vision] Image base64 length: ${imageBase64.length}`);

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Check your .env file.');
  }

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text();

  console.log('[Gemini Vision] Raw response:\n', text.substring(0, 500));
  return extractJSON(text);
}

async function analyzeSkinFromImage(imageBase64, mimeType) {
  const prompt = getSkinAnalysisPrompt();
  return await callGeminiVision(prompt, imageBase64, mimeType);
}

async function generateQuizQuestions(skinData) {
  const prompt = getQuizPrompt(skinData);
  const result = await callGemini(prompt);

  if (!result.questions || !Array.isArray(result.questions)) {
    throw new Error('Quiz response missing "questions" array');
  }

  return result.questions;
}

async function analyzeResults(skinData, answers) {
  const prompt = getAnalysisPrompt(skinData, answers);
  return await callGemini(prompt);
}

module.exports = {
  analyzeSkinFromImage,
  generateQuizQuestions,
  analyzeResults,
};