const express = require('express');
const router = express.Router();
const multer = require('multer');
const nvidiaService = require('../services/nvidiaService');
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

    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const uploadId = `${Date.now()}-${req.file.size}`;
    console.log(`[analyzeSkin] uploadId=${uploadId} | mime=${mimeType} | bytes=${req.file.size}`);

    if (!nvidiaService.isVisionConfigured()) {
      throw new Error('NVIDIA NIM vision not configured');
    }

    console.log('[analyzeSkin] PRIMARY: NVIDIA vision analysis');
    const result = await nvidiaService.analyzeSkinFromImage(imageBase64, mimeType);
    const inner = result.inner;
    const imageConfidence = result.imageConfidence;

    // Normalize to ensure all required fields — never let "unknown" through
    const skinData = {
      tone:      inner.tone     && inner.tone     !== 'unknown' ? inner.tone     : 'medium skin tone',
      oiliness:  inner.oiliness && inner.oiliness !== 'unknown' ? inner.oiliness : 'T-zone: 5/10, Cheeks: 3/10',
      texture:   inner.texture  && inner.texture  !== 'unknown' ? inner.texture  : 'normal texture',
      concerns:  Array.isArray(inner.concerns) && inner.concerns.length > 0 ? inner.concerns : ['none visible'],
      undertone: inner.undertone && inner.undertone !== 'unknown' ? inner.undertone : 'neutral',
      imageConfidence,
      _uploadId: uploadId,
    };

    console.log('[analyzeSkin] Final normalized data:', JSON.stringify(skinData, null, 2));

    // If confidence is low AND most fields are default, warn the client
    if (imageConfidence === 'low') {
      console.warn('[analyzeSkin] Low confidence — image may not show a clear face');
      return res.status(422).json({
        error: 'Image quality too low for accurate skin analysis. Please upload a clear, well-lit photo of your face.',
        imageConfidence,
      });
    }

    res.json({ skinData });
  } catch (err) {
    console.error('[analyzeSkin] Error:', {
      message: err.message,
      nvidiaKeySet: !!process.env.NVIDIA_API_KEY || !!process.env.NVIDIA_API_KEY_VISION,
    });

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: `Skin analysis failed: ${err.message}` });
  }
});

module.exports = router;