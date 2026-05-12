const express = require('express');
const router = express.Router();
const nvidiaService = require('../services/nvidiaService');

const DOSHA_QUESTIONS = [
  {
    question: 'What best describes your daily lifestyle?',
    options: ['Active and fast-paced', 'Intense and competitive', 'Calm and steady', 'Balanced and flexible'],
  },
  {
    question: 'Which dietary habits resonate with you most?',
    options: ['Irregular meals, often forget to eat', 'Regular meals, prefer spicy and hot foods', 'Heavy meals, love rich and sweet foods', 'Balanced diet, moderate appetite'],
  },
  {
    question: 'How would you describe your sleep pattern?',
    options: ['Light sleeper, mind races at night', 'Moderate sleep, wake up if disturbed', 'Deep sleeper, hard to wake up', 'Variable, depends on the day'],
  },
];

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
    const dynamicQuestions = response.questions;

    const allQuestions = [...dynamicQuestions, ...DOSHA_QUESTIONS];

    res.json({ questions: allQuestions });
  } catch (err) {
    console.error('[generateQuiz] error:', err.message);
    res.status(500).json({ error: 'Quiz generation failed: ' + err.message });
  }
});

module.exports = router;
