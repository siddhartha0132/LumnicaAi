const express = require('express');
const router = express.Router();
const doshaService = require('../services/doshaService');
const { AppError } = require('../middleware/errorHandler');

router.post('/', (req, res, next) => {
  try {
    const { skinData } = req.body;

    if (!skinData || typeof skinData !== 'object') {
      throw new AppError('skinData is required', 400);
    }

    const questions = doshaService.getQuiz(skinData);
    console.log(`[generateQuiz] ${questions.length} questions: ${questions.map(q => q.id).join(', ')}`);

    res.json({ questions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
