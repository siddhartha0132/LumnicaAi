const express = require('express');
const router = express.Router();
const multer = require('multer');
const nvidiaService = require('../services/nvidiaService');

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
 */
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const mlData = req.body.mlData ? JSON.parse(req.body.mlData) : null;

    if (!mlData) {
      return res.status(400).json({ error: 'Missing mlData in request' });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Image is required for skin analysis'
      });
    }

    console.log('[ML Analysis] Sending to NVIDIA Vision for accurate analysis...');
    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const uploadId = `${Date.now()}-${req.file.size}`;
    console.log(`[ML Analysis] uploadId=${uploadId} | mime=${mimeType} | bytes=${req.file.size}`);

    if (!nvidiaService.isVisionConfigured()) {
      throw new Error('NVIDIA NIM vision not configured');
    }

    console.log('[ML Analysis] PRIMARY: NVIDIA Nemotron Omni vision analysis');
    const result = await nvidiaService.analyzeSkinFromImage(imageBase64, mimeType);
    const inner = result.inner;
    const imageConfidence = result.imageConfidence;

    // Normalize the data to ensure consistent format
    const normalizedData = {
      tone: inner.tone || 'unable to determine',
      oiliness: inner.oiliness || 'unable to determine',
      texture: inner.texture || 'unable to determine',
      concerns: Array.isArray(inner.concerns) ? inner.concerns : ['none visible'],
      undertone: inner.undertone || 'unable to determine',
      imageConfidence,
      _uploadId: uploadId,
    };
    
    console.log('[ML Analysis] Normalized data:', JSON.stringify(normalizedData, null, 2));
    res.json({ skinData: normalizedData });

  } catch (err) {
    console.error('[ML Analysis] Error:', err);
    res.status(500).json({ error: 'Skin analysis failed: ' + err.message });
  }
});

module.exports = router;
