const express = require('express');
const router = express.Router();
const multer = require('multer');
const { analyzeSkinFromImage } = require('../services/geminiService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/avif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, AVIF, WEBP allowed.'));
    }
  },
});

const DEMO_MODE = process.env.DEMO_MODE === 'true';

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    let skinData;

    if (DEMO_MODE) {
      console.log('Running in DEMO_MODE');
      skinData = {
        tone: 'medium warm',
        oiliness: 'combination',
        texture: 'slightly uneven',
        concerns: ['acne scars', 'dark spots', 'enlarged pores'],
        undertone: 'warm golden',
      };
    } else {
      console.log('Calling Gemini API for skin analysis...');
      const imageBase64 = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;
      skinData = await analyzeSkinFromImage(imageBase64, mimeType);
      console.log('Gemini analysis success:', skinData);
    }

    res.json({ skinData });
  } catch (err) {
    // Log the REAL error, not just a generic message
    console.error('analyzeSkin error details:', {
      message: err.message,
      stack: err.stack,
      geminiKey: process.env.GEMINI_API_KEY ? 'SET (length: ' + process.env.GEMINI_API_KEY.length + ')' : 'NOT SET',
      demoMode: process.env.DEMO_MODE,
    });
    res.status(500).json({ error: 'Skin analysis failed: ' + err.message });
  }
});

module.exports = router;