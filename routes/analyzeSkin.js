const express = require('express');
const router = express.Router();
const { upload, handleUploadError } = require('../middleware/upload');
const { analyzeSkinFromImage, getSkinAnalysisPrompt } = require('../services/geminiService');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const DEMO_SKIN_DATA = {
  tone: 'medium warm',
  fitzpatrickType: 'IV',
  approximateHex: '#C68642',
  oiliness: 'combination',
  texture: 'slightly uneven',
  concerns: ['enlarged pores', 'mild acne', 'post-acne marks'],
  undertone: 'warm golden',
};

router.post('/', upload.single('image'), handleUploadError, async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No image uploaded', 400);
    }

    const skinData = config.demo.enabled
      ? DEMO_SKIN_DATA
      : await analyzeSkinFromImage(
          req.file.buffer.toString('base64'),
          req.file.mimetype,
          getSkinAnalysisPrompt()
        );

    logger.info('Skin analysis complete', { tone: skinData.tone, fitzpatrick: skinData.fitzpatrickType });

    res.json({ skinData });
  } catch (err) {
    next(err);
  }
});

module.exports = router;