const express = require('express');
const router = express.Router();
const { generateQuizQuestions } = require('../services/geminiService');
const nvidiaService = require('../services/nvidiaService');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const DOSHA_QUESTIONS = [
  {
    question: 'What best describes your daily lifestyle?',
    options: ['Active and fast-paced (Vata)', 'Intense and competitive (Pitta)', 'Calm and steady (Kapha)', 'Balanced and flexible'],
  },
  {
    question: 'Which dietary habits describe you best?',
    options: ['Irregular meals, often forget to eat (Vata)', 'Regular, prefer spicy and hot foods (Pitta)', 'Heavy meals, love rich and sweet foods (Kapha)', 'Balanced diet, moderate appetite'],
  },
  {
    question: 'How would you describe your sleep pattern?',
    options: ['Light sleeper, mind races at night (Vata)', 'Moderate sleep, wake if disturbed (Pitta)', 'Deep sleeper, hard to wake up (Kapha)', 'Variable, depends on the day'],
  },
];

const DEMO_QUESTIONS = [
  { question: 'How often do you experience breakouts or acne flare-ups?', options: ['Daily', '2-3 times per week', 'Once a week', 'Rarely'] },
  { question: 'What is your current skincare routine?', options: ['Minimal (nothing)', 'Basic (cleanser + moisturizer)', 'Moderate (3-4 products)', 'Extensive (6+ products)'] },
  { question: 'How would you describe your skin by midday?', options: ['Very oily, shiny all over', 'Oily T-zone, dry cheeks', 'Dry and tight', 'Normal, no major issues'] },
  { question: 'How many hours of screen time do you have daily?', options: ['Less than 2 hours', '2-4 hours', '4-6 hours', 'More than 6 hours'] },
  { question: 'Do you wear makeup or heavy products daily?', options: ['Yes, heavy coverage daily', 'Yes, light coverage', 'Occasionally on weekends', 'Never'] },
];

const AIModel = {
  async generate(skinData) {
    if (nvidiaService.isConfigured() && !config.demo.enabled) {
      logger.debug('Using NVIDIA NIM for quiz generation');
      return nvidiaService.generateQuizQuestions(skinData);
    }
    logger.debug('Using Gemini for quiz generation');
    return generateQuizQuestions(skinData);
  },
};

router.post('/', async (req, res, next) => {
  try {
    const { skinData } = req.body;

    if (!skinData) {
      throw new AppError('skinData is required', 400);
    }

    let dynamicQuestions;

    if (config.demo.enabled) {
      dynamicQuestions = DEMO_QUESTIONS;
    } else {
      dynamicQuestions = await AIModel.generate(skinData);
    }

    const allQuestions = [...dynamicQuestions, ...DOSHA_QUESTIONS];
    logger.info('Quiz generated', { totalQuestions: allQuestions.length });

    res.json({ questions: allQuestions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;