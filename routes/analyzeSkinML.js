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

    // Use Gemini Vision with the on-device ML data as supplementary context.
    // Gemini analyzes what it ACTUALLY sees in the image — not ML pixel averages.
    const { analyzeSkinFromImage } = require('../services/geminiService');
    const geminiData = await analyzeSkinFromImage(imageBase64, mimeType);

    console.log('[ML Analysis] Gemini Vision analysis complete:', geminiData);
    res.json({ skinData: geminiData });

  } catch (err) {
    console.error('[ML Analysis] Error:', err);
    res.status(500).json({ error: 'Skin analysis failed: ' + err.message });
  }
});

module.exports = router;
