const express = require('express');
const router = express.Router();
const doshaService = require('../services/doshaService');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

router.post('/', (req, res, next) => {
  try {
    const { skinData, answers, questionIds } = req.body;

    if (!skinData || typeof skinData !== 'object' || !answers) {
      throw new AppError('skinData and answers are required', 400);
    }

    if (!Array.isArray(answers) || answers.length < 3) {
      throw new AppError('At least 3 answers are required', 400);
    }

    if (questionIds !== undefined && (!Array.isArray(questionIds) || questionIds.length !== answers.length)) {
      throw new AppError('questionIds must be an array matching answers', 400);
    }

    const analysis = doshaService.analyze({ skinData, answers, questionIds });

    logger.info('Analysis complete', {
      dosha: analysis.dosha.type,
      scores: analysis.dosha.scores,
      concerns: analysis.skinProfile.concerns,
    });

    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
