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
        tone: 'medium warm',
        oiliness: 'combination',
        texture: 'slightly uneven',
        concerns: ['acne scars', 'dark spots', 'enlarged pores'],
        undertone: 'warm golden',
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
        skinData = await analyzeSkinFromImage(imageBase64, mimeType);
        
        // Normalize to ensure all required fields
        skinData = {
          tone: skinData.tone || 'medium',
          fitzpatrickType: skinData.fitzpatrickType || 'III',
          approximateHex: skinData.approximateHex || '#C68642',
          oiliness: skinData.oiliness || 'normal',
          texture: skinData.texture || 'smooth',
          concerns: Array.isArray(skinData.concerns) ? skinData.concerns : ['general skin health'],
          undertone: skinData.undertone || 'neutral',
          confidence: skinData.confidence || { score: 0.85, notes: 'Analysis complete' }
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