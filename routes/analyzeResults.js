const express = require('express');
const router = express.Router();
const { analyzeResults } = require('../services/geminiService');
const nvidiaService = require('../services/nvidiaService');
const productService = require('../services/productService');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const DEMO_RESPONSE = {
  dosha: {
    type: 'Pitta-Kapha',
    description: 'Your Pitta-Kapha constitution combines fire and earth elements, leading to combination skin prone to oiliness and inflammation. Cooling and balancing treatments work best for you.',
  },
  skinProfile: {
    tone: 'medium warm',
    type: 'combination',
    concerns: ['acne scars', 'dark spots', 'enlarged pores'],
    undertone: 'warm golden',
  },
  routine: {
    morning: [
      { step: 'Cleanse', product: 'Neem & Tulsi Face Wash', reason: 'Purifies without stripping natural oils, balances Pitta heat' },
      { step: 'Tone', product: 'Rose Water Toner', reason: 'Cooling and soothing for Pitta constitution' },
      { step: 'Serum', product: 'Niacinamide & Zinc Serum', reason: 'Controls oil and minimizes pores' },
      { step: 'Moisturize', product: 'Aloe Vera Gel', reason: 'Lightweight hydration that does not aggravate Kapha' },
      { step: 'Protect', product: 'Mineral Sunscreen SPF 50', reason: 'Prevents pigmentation worsened by Pitta sun sensitivity' },
    ],
    night: [
      { step: 'Double Cleanse', product: 'Coconut Oil + Neem Face Wash', reason: 'Removes deep impurities accumulated by Kapha' },
      { step: 'Exfoliate', product: 'Glycolic Acid Toner (3x/week)', reason: 'Gently fades acne scars without inflaming Pitta' },
      { step: 'Treatment', product: 'Kumkumadi Tailam Face Oil', reason: 'Traditional Ayurvedic brightening oil for Pitta skin' },
      { step: 'Night Cream', product: 'Saffron & Gold Night Cream', reason: 'Repairs and brightens overnight' },
    ],
    weekly: [
      { step: 'Face Mask', product: 'Multani Mitti + Rose Water (2x/week)', reason: 'Deep cleanses Kapha-blocked pores' },
      { step: 'Exfoliate', product: 'Chickpea Flour + Turmeric Scrub (1x/week)', reason: 'Natural exfoliation balances both doshas' },
    ],
  },
  products: [
    { name: 'Kumkumadi Tailam Face Oil', price: 1299, benefit: 'Reduces dark spots, brightens complexion' },
    { name: 'Neem & Tulsi Face Wash', price: 249, benefit: 'Controls acne, purifies skin' },
    { name: 'Niacinamide & Zinc Serum', price: 749, benefit: 'Controls oil, minimizes pores' },
    { name: 'Saffron & Gold Night Cream', price: 649, benefit: 'Repairs skin overnight' },
    { name: 'Rose Water Toner', price: 199, benefit: 'Balances pH, minimizes pores' },
    { name: 'Multani Mitti Face Pack', price: 149, benefit: 'Deep cleanses, controls oil' },
    { name: 'Aloe Vera Gel', price: 299, benefit: 'Soothes inflammation' },
  ],
  doshaInsights: 'Drink cooling herbal teas like coriander or fennel. Avoid spicy foods which aggravate Pitta. Sleep before 10pm to keep Kapha balanced. Practice gentle yoga for stress management.',
};

const AIModel = {
  async analyze(skinData, answers) {
    if (nvidiaService.isConfigured() && !config.demo.enabled) {
      logger.debug('Using NVIDIA NIM for analysis');
      return nvidiaService.analyzeResults(skinData, answers);
    }
    logger.debug('Using Gemini for analysis');
    return analyzeResults(skinData, answers);
  },
};

router.post('/', async (req, res, next) => {
  try {
    const { skinData, answers } = req.body;

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
      analysis = await AIModel.analyze(skinData, answers);

      if (analysis.products && analysis.products.length > 0) {
        const curatedProducts = productService.selectProductsForAnalysis(
          analysis.dosha?.type || skinData.tone,
          skinData,
          7
        );
        if (curatedProducts.length >= 5) {
          analysis.products = curatedProducts;
        }
      }
    }

    logger.info('Analysis complete', {
      dosha: analysis.dosha?.type || 'unknown',
      productCount: analysis.products?.length || 0,
    });

    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

module.exports = router;