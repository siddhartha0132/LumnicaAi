const express = require('express');
const router = express.Router();
const nvidiaService = require('../services/nvidiaService');
const productService = require('../services/productService');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

router.post('/', async (req, res, next) => {
  try {
    const { skinData, answers } = req.body;
    const suggestProducts = req.query.suggestProducts !== 'false' && config.products.suggestProducts;

    if (!skinData || !answers) {
      throw new AppError('skinData and answers are required', 400);
    }

    if (!Array.isArray(answers) || answers.length < 3) {
      throw new AppError('At least 3 answers are required', 400);
    }

    let analysis;

    if (!nvidiaService.isConfigured()) {
      throw new AppError('NVIDIA NIM not configured', 500);
    }

    logger.debug('Using NVIDIA Nemotron for final analysis');
    analysis = await nvidiaService.analyzeResults(skinData, answers);

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
