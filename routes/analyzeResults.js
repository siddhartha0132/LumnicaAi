const express = require('express');
const router = express.Router();
const { analyzeResults } = require('../services/geminiService');
// const { analyzeResultsWithClaude } = require('../services/claudeService');

const DEMO_MODE = process.env.DEMO_MODE === 'true';

const DEMO_RESPONSE = {
  dosha: { type: 'Pitta-Kapha', description: 'Your Pitta-Kapha constitution combines fire and earth elements, leading to combination skin prone to oiliness and inflammation. Cooling and balancing treatments work best for you.' },
  skinProfile: { tone: 'medium warm', type: 'combination', concerns: ['acne scars', 'dark spots', 'enlarged pores'], undertone: 'warm golden' },
  routine: {
    morning: [
      { step: 'Cleanse', product: 'Neem and Tulsi Face Wash', reason: 'Purifies without stripping natural oils, balances Pitta heat' },
      { step: 'Tone', product: 'Rose Water Toner', reason: 'Cooling and soothing for Pitta constitution' },
      { step: 'Serum', product: 'Vitamin C Serum with Turmeric', reason: 'Fades dark spots naturally using Ayurvedic brightening' },
      { step: 'Moisturize', product: 'Aloe Vera Gel', reason: 'Lightweight hydration that does not aggravate Kapha' },
      { step: 'Protect', product: 'Mineral Sunscreen SPF 50', reason: 'Prevents pigmentation worsened by Pitta sun sensitivity' },
    ],
    night: [
      { step: 'Double Cleanse', product: 'Coconut Oil + Neem Face Wash', reason: 'Removes deep impurities accumulated by Kapha' },
      { step: 'Exfoliate', product: 'Lactic Acid Toner (3x/week)', reason: 'Gently fades acne scars without inflaming Pitta' },
      { step: 'Treatment', product: 'Kumkumadi Oil', reason: 'Traditional Ayurvedic brightening oil for Pitta skin' },
      { step: 'Night Cream', product: 'Saffron Night Cream', reason: 'Repairs and brightens overnight' },
    ],
    weekly: [
      { step: 'Face Mask', product: 'Multani Mitti + Rose Water (2x/week)', reason: 'Deep cleanses Kapha-blocked pores' },
      { step: 'Exfoliate', product: 'Chickpea Flour + Turmeric Scrub (1x/week)', reason: 'Natural exfoliation balances both doshas' },
    ],
  },
  products: [
    { name: 'Kumkumadi Tailam Face Oil', price: 1299, benefit: 'Reduces dark spots, brightens complexion' },
    { name: 'Neem & Tulsi Face Wash', price: 249, benefit: 'Controls acne, purifies skin' },
    { name: 'Vitamin C Serum with Turmeric', price: 899, benefit: 'Brightens skin, fades pigmentation' },
    { name: 'Saffron Night Cream', price: 649, benefit: 'Repairs skin overnight' },
    { name: 'Rose Water Toner', price: 199, benefit: 'Balances pH, minimizes pores' },
    { name: 'Multani Mitti Face Pack', price: 149, benefit: 'Deep cleanses, controls oil' },
    { name: 'Aloe Vera Gel', price: 299, benefit: 'Soothes inflammation' },
  ],
  doshaInsights: 'Drink cooling herbal teas like coriander or fennel. Avoid spicy foods which aggravate Pitta. Sleep before 10pm to keep Kapha balanced.',
};

router.post('/', async (req, res) => {
  try {
    const { skinData, answers, questions } = req.body;

    if (!skinData || !answers) {
      return res.status(400).json({ error: 'skinData and answers are required' });
    }

    let analysis;

    if (DEMO_MODE) {
      analysis = DEMO_RESPONSE;
    } else {
      // === REAL MODE: Gemini full analysis ===
      analysis = await analyzeResults(skinData, answers);

      // === CLAUDE MODE (alternative paid option) ===
      // analysis = await analyzeResultsWithClaude(skinData, answers, questions || []);
    }

    res.json(analysis);
  } catch (err) {
    console.error('analyzeResults error:', err);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

module.exports = router;
