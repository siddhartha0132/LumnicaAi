const express = require('express');
const router = express.Router();
const { analyzeResults } = require('../services/geminiService');
const nvidiaService = require('../services/nvidiaService');
const productService = require('../services/productService');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const DEMO_RESPONSE = {
  dosha: { type: 'Pitta-Kapha', description: 'Your Pitta-Kapha constitution combines fire and earth elements, leading to combination skin prone to oiliness and inflammation. Cooling and balancing treatments work best for you.' },
  skinProfile: { tone: 'medium warm', type: 'combination', concerns: ['acne scars', 'dark spots', 'enlarged pores'], undertone: 'warm golden' },
  routine: {
    morning: [
      { step: 'Cleanse', product: 'Neem and Tulsi Face Wash', reason: 'Purifies without stripping natural oils, balances Pitta heat' },
      { step: 'Tone', product: 'Rose Water Toner', reason: 'Cooling and soothing for Pitta constitution' },
      { step: 'Serum', product: 'Vitamin C Serum with Turmeric', reason: 'Fades dark spots naturally using Ayurvedic brightening' },
      { step: 'Moisturizer', product: 'Aloe Vera Gel', reason: 'Lightweight hydration that does not aggravate Kapha' },
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

router.post('/', async (req, res, next) => {
  try {
    const { skinData, answers } = req.body;
    const suggestProducts = req.query.suggestProducts !== 'false' && config.products.suggestProducts;

    if (!skinData || !answers) {
      throw new AppError('skinData and answers are required', 400);
    }

    if (!Array.isArray(answers) || answers.length < 6) {
      throw new AppError('At least 6 answers are required', 400);
    }

    let analysis;

    if (config.demo.enabled) {
      analysis = DEMO_RESPONSE;
    } else {
      if (nvidiaService.isConfigured()) {
        try {
          logger.debug('Using NVIDIA Nemotron for final analysis');
          analysis = await nvidiaService.analyzeResults(skinData, answers);
        } catch (nvidiaErr) {
          logger.error(`NVIDIA final analysis failed: ${nvidiaErr.message}, falling back to Gemini`);
          analysis = await analyzeResults(skinData, answers);
        }
      } else {
        logger.debug('Using Gemini for final analysis');
        analysis = await analyzeResults(skinData, answers);
      }

      // Only include products if SUGGEST_PRODUCTS is enabled
      if (suggestProducts && analysis.products && analysis.products.length > 0) {
        const curatedProducts = productService.selectProductsForAnalysis(
          analysis.dosha?.type || skinData.tone,
          skinData,
          7
        );
        if (curatedProducts.length >= 5) {
          analysis.products = curatedProducts;
        }
      } else if (!suggestProducts) {
        // Remove products from analysis if suggestions are disabled
        analysis.products = [];
      }
    }

    // Remove products from demo response if suggestions are disabled
    if (!suggestProducts && analysis.products) {
      analysis.products = [];
    }

    logger.info('Analysis complete', {
      dosha: analysis.dosha?.type || 'unknown',
      productCount: analysis.products?.length || 0,
      suggestProducts,
    });

    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
