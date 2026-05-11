const express = require('express');
const router = express.Router();
const multer = require('multer');
const { analyzeSkinFromImageFallback, analyzeSkinFromImage } = require('../services/geminiService');
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

    // Stamp this request so we can verify uniqueness in logs
    const uploadId = `${Date.now()}-${req.file.size}`;
    console.log(`[ML Analysis] uploadId=${uploadId} | mime=${mimeType} | bytes=${req.file.size}`);

    let inner, imageConfidence;

    // —— PRIMARY: NVIDIA Nemotron Omni (vision-capable reasoning model) ——
    if (nvidiaService.isConfigured()) {
      try {
        console.log('[ML Analysis] PRIMARY: NVIDIA Nemotron Omni vision analysis');
        const result = await nvidiaService.analyzeSkinFromImage(imageBase64, mimeType);
        inner = result.inner;
        imageConfidence = result.imageConfidence;
      } catch (nvidiaErr) {
        console.error('[ML Analysis] NVIDIA failed, falling back to Gemini:', nvidiaErr.message);
        console.log('[ML Analysis] FALLBACK: Gemini Vision (NVIDIA failed)');
        const rawResult = await analyzeSkinFromImage(imageBase64, mimeType);
        console.log('[ML Analysis] RAW Gemini response:', JSON.stringify(rawResult, null, 2));
        inner = rawResult.skinData || rawResult;
        imageConfidence = rawResult.imageConfidence || 'unknown';
      }
    } else {
      // —— FALLBACK: Gemini Vision ——
      console.log('[ML Analysis] FALLBACK: Gemini Vision (NVIDIA not configured)');
      const rawResult = await analyzeSkinFromImage(imageBase64, mimeType);
      console.log('[ML Analysis] RAW Gemini response:', JSON.stringify(rawResult, null, 2));
      inner = rawResult.skinData || rawResult;
      imageConfidence = rawResult.imageConfidence || 'unknown';
    }

    // ⚠️  Hardcoded-value detector — fires if model slips back to generic defaults
    const HARDCODED_TONES = ['medium', 'fair', 'dark', 'light'];
    const HARDCODED_OILINESS = ['balanced', 'combination', 'oily', 'dry', 'normal'];
    const HARDCODED_CONCERNS = ['hydration', 'fine lines', 'general skin health'];
    const isHardcodedTone = HARDCODED_TONES.includes((inner.tone || '').toLowerCase().trim());
    const isHardcodedOiliness = HARDCODED_OILINESS.includes((inner.oiliness || '').toLowerCase().trim());
    const hasHardcodedConcern = Array.isArray(inner.concerns) &&
      inner.concerns.some(c => HARDCODED_CONCERNS.includes((c || '').toLowerCase().trim()));

    if (isHardcodedTone || isHardcodedOiliness || hasHardcodedConcern) {
      console.warn('⚠️  [ML Analysis] WARNING: Model returned hardcoded/generic values!');
      console.warn('    tone:', inner.tone, '| oiliness:', inner.oiliness, '| concerns:', inner.concerns);
    }

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
