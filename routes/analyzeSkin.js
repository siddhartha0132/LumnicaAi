const express = require('express');
const router = express.Router();
const multer = require('multer');
const { analyzeSkinFromImage } = require('../services/geminiService');
const config = require('../config');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/avif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, AVIF, WEBP allowed.'));
    }
  },
});

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    let skinData;

    if (config.demo.enabled) {
      console.log('[analyzeSkin] Running in DEMO_MODE');
      skinData = {
        tone: 'light beige with warm peach tones (80% even, 20% redness around nose)',
        oiliness: 'T-zone: 6/10 oily, Cheeks: 2/10 dry',
        texture: 'slightly uneven with visible pores around nose, smooth on cheeks',
        concerns: ['mild redness on nose bridge', 'slightly enlarged pores'],
        undertone: 'warm',
        imageConfidence: 'demo',
      };
    } else {
      const imageBase64 = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;

      // Check if NVIDIA Vision is configured (future support)
      // Currently NVIDIA NIM is text-only; Gemini handles vision (image) analysis
      // When NVIDIA adds vision support, swap the provider here via env var
      const useNvidiaVision = config.providers.nvidia.apiKey &&
        process.env.NVIDIA_VISION_ENABLED === 'true';

      if (useNvidiaVision) {
        // Placeholder: NVIDIA vision support (enable via NVIDIA_VISION_ENABLED=true)
        console.log('[analyzeSkin] Using NVIDIA Vision API for skin analysis');
        skinData = await analyzeSkinFromImage(imageBase64, mimeType); // replace with nvidia vision call when available
      } else {
        console.log('[analyzeSkin] Using Gemini Vision for skin analysis');
        const rawResult = await analyzeSkinFromImage(imageBase64, mimeType);

        // ANTI_GRAVITY_PROMPT returns { skinData: { ... }, imageConfidence: '...' }
        // Unwrap the nested skinData if present, otherwise fall back to flat structure
        const inner = rawResult.skinData || rawResult;
        const imageConfidence = rawResult.imageConfidence || 'unknown';

        console.log('[analyzeSkin] imageConfidence:', imageConfidence);
        console.log('[analyzeSkin] inner skinData:', JSON.stringify(inner, null, 2));

        // Normalize to ensure all required fields
        skinData = {
          tone: inner.tone || 'unable to determine',
          oiliness: inner.oiliness || 'unable to determine',
          texture: inner.texture || 'unable to determine',
          concerns: Array.isArray(inner.concerns) ? inner.concerns : ['none visible'],
          undertone: inner.undertone || 'unable to determine',
          imageConfidence,
        };
      }

      console.log('[analyzeSkin] Final normalized data:', JSON.stringify(skinData, null, 2));
    }

    res.json({ skinData });
  } catch (err) {
    console.error('[analyzeSkin] Error:', {
      message: err.message,
      geminiKeySet: !!process.env.GEMINI_API_KEY,
      nvidiaKeySet: !!process.env.NVIDIA_API_KEY,
      demoMode: config.demo.enabled,
    });

    // Send clean error — no stack trace leak in production
    const statusCode = err.statusCode || 500;
    const message = config.env === 'production'
      ? 'Skin analysis failed. Please try again.'
      : `Skin analysis failed: ${err.message}`;

    res.status(statusCode).json({ error: message });
  }
});

module.exports = router;