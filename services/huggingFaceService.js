// services/huggingFaceService.js
const axios = require('axios');

const HF_TOKEN = process.env.HF_API_KEY;
const HF_BASE = 'https://api-inference.huggingface.co/models';

// Model 1: General image classification (skin tone / condition)
const SKIN_MODEL = 'Salesforce/blip-image-captioning-base';
// Model 2: Face attribute detection
const FACE_MODEL = 'microsoft/resnet-50';

async function analyzeSkinWithHF(imageBuffer, mimeType) {
  try {
    // Use BLIP captioning to get a description of the face/skin
    const captionRes = await axios.post(
      `${HF_BASE}/${SKIN_MODEL}`,
      imageBuffer,
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': mimeType || 'image/jpeg',
        },
        timeout: 30000,
      }
    );

    const caption = captionRes.data?.[0]?.generated_text || '';

    // Parse caption into structured skinData
    // (Claude will refine this further in analyzeResults)
    const skinData = parseCaptionToSkinData(caption);
    return skinData;
  } catch (err) {
    console.error('HF API error:', err.message);
    // Graceful fallback: return neutral skinData and let Claude do the heavy lifting
    return getFallbackSkinData();
  }
}

function parseCaptionToSkinData(caption) {
  const lower = caption.toLowerCase();
  return {
    tone: detectTone(lower),
    oiliness: detectOiliness(lower),
    texture: detectTexture(lower),
    concerns: detectConcerns(lower),
    undertone: detectUndertone(lower),
    rawCaption: caption, // pass to Claude for deeper reasoning
  };
}

function detectTone(text) {
  if (text.includes('dark')) return 'deep';
  if (text.includes('brown') || text.includes('tan')) return 'medium warm';
  if (text.includes('fair') || text.includes('light')) return 'fair';
  return 'medium';
}

function detectOiliness(text) {
  if (text.includes('shiny') || text.includes('oily')) return 'oily';
  if (text.includes('dry') || text.includes('flak')) return 'dry';
  return 'combination';
}

function detectTexture(text) {
  if (text.includes('smooth')) return 'smooth';
  if (text.includes('rough') || text.includes('uneven')) return 'uneven';
  return 'normal';
}

function detectConcerns(text) {
  const concerns = [];
  if (text.includes('acne') || text.includes('pimple')) concerns.push('acne');
  if (text.includes('spot') || text.includes('pigment')) concerns.push('dark spots');
  if (text.includes('wrinkle') || text.includes('line')) concerns.push('fine lines');
  if (text.includes('pore')) concerns.push('enlarged pores');
  if (concerns.length === 0) concerns.push('general maintenance');
  return concerns;
}

function detectUndertone(text) {
  if (text.includes('warm') || text.includes('yellow') || text.includes('golden')) return 'warm golden';
  if (text.includes('cool') || text.includes('pink') || text.includes('red')) return 'cool pink';
  return 'neutral';
}

function getFallbackSkinData() {
  return {
    tone: 'medium',
    oiliness: 'combination',
    texture: 'normal',
    concerns: ['general maintenance'],
    undertone: 'neutral',
    rawCaption: 'Image analysis unavailable — proceeding with questionnaire-based assessment',
  };
}

module.exports = { analyzeSkinWithHF };
