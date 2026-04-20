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
    
    const confidence = mlData.confidence?.score || 0;
    
    // If ML confidence is high enough, use it directly
    if (confidence >= 0.75) {
      console.log('[ML Analysis] High confidence, using on-device results');
      return res.json({ skinData: mlData });
    }
    
    // Low confidence — fallback to Gemini Vision
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Low ML confidence and no image provided for fallback' 
      });
    }
    
    console.log('[ML Analysis] Low confidence, calling Gemini fallback...');
    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    const geminiData = await analyzeSkinFromImageFallback(
      imageBase64, 
      mimeType, 
      mlData
    );
    
    console.log('[ML Analysis] Gemini fallback complete');
    res.json({ skinData: geminiData });
    
  } catch (err) {
    console.error('[ML Analysis] Error:', err);
    res.status(500).json({ error: 'Skin analysis failed: ' + err.message });
  }
});

module.exports = router;
