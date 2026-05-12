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

    console.log('[analyzeSkin] PRIMARY: NVIDIA Nemotron Omni vision analysis');
    const result = await nvidiaService.analyzeSkinFromImage(imageBase64, mimeType);
    const inner = result.inner;
    const imageConfidence = result.imageConfidence;

    // Normalize to ensure all required fields
    const skinData = {
      tone: inner.tone || 'unable to determine',
      oiliness: inner.oiliness || 'unable to determine',
      texture: inner.texture || 'unable to determine',
      concerns: Array.isArray(inner.concerns) ? inner.concerns : ['none visible'],
      undertone: inner.undertone || 'unable to determine',
      imageConfidence,
      _uploadId: uploadId,
    };

    console.log('[analyzeSkin] Final normalized data:', JSON.stringify(skinData, null, 2));

    res.json({ skinData });
  } catch (err) {
    console.error('[analyzeSkin] Error:', {
      message: err.message,
      nvidiaKeySet: !!process.env.NVIDIA_API_KEY,
    });

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: `Skin analysis failed: ${err.message}` });
  }
});

module.exports = router;