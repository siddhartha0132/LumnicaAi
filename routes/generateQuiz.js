const express = require('express');
const router = express.Router();
const { generateQuizQuestions } = require('../services/geminiService');
const nvidiaService = require('../services/nvidiaService');
// const { generateQuizQuestionsWithClaude } = require('../services/claudeService');

const DEMO_MODE = process.env.DEMO_MODE === 'true';

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

const DEMO_QUESTIONS = [
  { question: 'How often do you experience breakouts or acne flare-ups?', options: ['Daily', '2-3 times per week', 'Once a week', 'Rarely'] },
  { question: 'What is your current skincare routine like?', options: ['Minimal (nothing)', 'Basic (cleanser + moisturizer)', 'Moderate (3-4 products)', 'Extensive (6+ products)'] },
  { question: 'How would you describe your skin by midday?', options: ['Very oily, shiny all over', 'Oily T-zone, dry cheeks', 'Dry and tight', 'Normal, no major issues'] },
  { question: 'How many hours of screen time do you have daily?', options: ['Less than 2 hours', '2-4 hours', '4-6 hours', 'More than 6 hours'] },
  { question: 'Do you wear makeup or heavy products daily?', options: ['Yes, heavy coverage daily', 'Yes, light coverage', 'Occasionally on weekends', 'Never'] },
];

router.post('/', async (req, res) => {
  try {
    const { skinData } = req.body;

    if (!skinData) {
      console.error('Missing skinData in request');
      return res.status(400).json({ error: 'skinData is required' });
    }

    console.log('Generating quiz for skinData:', JSON.stringify(skinData, null, 2));

    let dynamicQuestions;

    if (DEMO_MODE) {
      console.log('Using DEMO_MODE questions');
      dynamicQuestions = DEMO_QUESTIONS;
    } else {
      console.log('[generateQuiz] Using Gemini for quiz generation...');
      try {
        dynamicQuestions = await generateQuizQuestions(skinData);
      } catch (geminiErr) {
        console.warn('[generateQuiz] Gemini failed, using fallback questions:', geminiErr.message);
        dynamicQuestions = DEMO_QUESTIONS;
      }
    }

    const allQuestions = [...dynamicQuestions, ...DOSHA_QUESTIONS];

    res.json({ questions: allQuestions });
  } catch (err) {
    console.error('generateQuiz error:', err.message);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: 'Quiz generation failed: ' + err.message });
  }
});

module.exports = router;
