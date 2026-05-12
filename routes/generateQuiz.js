const express = require('express');
const router = express.Router();
const nvidiaService = require('../services/nvidiaService');

router.post('/', async (req, res) => {
  try {
    const { skinData } = req.body;

    if (!skinData) {
      return res.status(400).json({ error: 'skinData is required' });
    }

    console.log('[generateQuiz] skinData received:', JSON.stringify(skinData, null, 2));

    if (!nvidiaService.isConfigured()) {
      throw new Error('NVIDIA NIM not configured');
    }

    console.log('[generateQuiz] PRIMARY: Using NVIDIA to generate quiz');
    const response = await nvidiaService.generateQuizQuestions(skinData);

    res.json({ questions: response.questions });
  } catch (err) {
    console.error('[generateQuiz] error:', err.message);
    res.status(500).json({ error: 'Quiz generation failed: ' + err.message });
  }
});

module.exports = router;
