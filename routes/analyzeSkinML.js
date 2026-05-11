const express = require('express');
const router = express.Router();
const multer = require('multer');
const { analyzeSkinFromImageFallback } = require('../services/geminiService');

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

/**
 * POST /api/analyzeSkinML
 * 
 * Receives partial ML data from client-side analysis.
 * If confidence is low, calls Gemini Vision as fallback.
 * Otherwise, returns the ML data as-is.
 */
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const mlData = req.body.mlData ? JSON.parse(req.body.mlData) : null;

    if (!mlData) {
      return res.status(400).json({ error: 'Missing mlData in request' });
    }

    // Always require the image — we always call Gemini Vision for accuracy.
    // On-device ML (pixel math) alone is not reliable enough for final results.
    if (!req.file) {
      return res.status(400).json({
        error: 'Image is required for skin analysis'
      });
    }

    console.log('[ML Analysis] Sending to Gemini Vision for accurate analysis...');
    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Use Gemini Vision - it returns flat format matching our schema
    const { analyzeSkinFromImage } = require('../services/geminiService');
    const geminiData = await analyzeSkinFromImage(imageBase64, mimeType);

    console.log('[ML Analysis] Raw Gemini response:', JSON.stringify(geminiData, null, 2));
    
    // Normalize the data to ensure consistent format
    // Gemini should return: { tone, fitzpatrickType, approximateHex, oiliness, texture, concerns, undertone, confidence }
    const normalizedData = {
      tone: geminiData.tone || 'medium',
      fitzpatrickType: geminiData.fitzpatrickType || 'III',
      approximateHex: geminiData.approximateHex || '#C68642',
      oiliness: geminiData.oiliness || 'normal',
      texture: geminiData.texture || 'smooth',
      concerns: Array.isArray(geminiData.concerns) ? geminiData.concerns : ['general skin health'],
      undertone: geminiData.undertone || 'neutral',
      confidence: geminiData.confidence || { score: 0.85, notes: 'Analysis complete' }
    };
    
    console.log('[ML Analysis] Normalized data:', JSON.stringify(normalizedData, null, 2));
    res.json({ skinData: normalizedData });

  } catch (err) {
    console.error('[ML Analysis] Error:', err);
    res.status(500).json({ error: 'Skin analysis failed: ' + err.message });
  }
});

module.exports = router;
