const express = require('express');
const router = express.Router();
const { upload, handleUploadError } = require('../middleware/upload');
const { analyzeSkinFromImageFallback, getSkinAnalysisFallbackPrompt } = require('../services/geminiService');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

router.post('/', upload.single('image'), handleUploadError, async (req, res, next) => {
  try {
    let mlData;
    try {
      mlData = req.body.mlData ? JSON.parse(req.body.mlData) : null;
    } catch {
      throw new AppError('Invalid mlData JSON format', 400);
    }

    const confidence = mlData?.confidence?.score || 0;
    const threshold = config.ml.confidenceThreshold;

    if (confidence >= threshold) {
      logger.debug('ML confidence high, using on-device results', { confidence });
      return res.json({ skinData: mlData });
    }

    if (!req.file) {
      throw new AppError('Low ML confidence and no image provided for fallback analysis', 400);
    }

    const skinData = await analyzeSkinFromImageFallback(
      req.file.buffer.toString('base64'),
      req.file.mimetype,
      mlData,
      getSkinAnalysisFallbackPrompt(mlData)
    );

    logger.info('ML fallback analysis complete', { originalConfidence: confidence, tone: skinData.tone });

    res.json({ skinData });
  } catch (err) {
    next(err);
  }
});

module.exports = router;