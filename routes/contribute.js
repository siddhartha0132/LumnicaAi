const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const storage = require('../services/contributionStorage');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Bump when the consent wording in public/index.html changes, so each record says what was agreed to.
const CONSENT_VERSION = '2026-10-01';
const ID_PATTERN = /^[0-9a-f-]{36}$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, fields: 10 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype);
    cb(ok ? null : new AppError('Only JPEG, PNG, WEBP or AVIF images', 400), ok);
  },
});

const asList = (value, max = 20) =>
  Array.isArray(value) ? value.filter(v => typeof v === 'string').slice(0, max).map(v => v.slice(0, 80)) : [];

const scores = v => (v && typeof v === 'object'
  ? Object.fromEntries(Object.entries(v).slice(0, 10)
    .filter(([, x]) => typeof x === 'number').map(([k, x]) => [k.slice(0, 20), x]))
  : null);

/** Keep only the fields we expect; nothing free-form or identifying is stored. */
function cleanMetadata(raw) {
  let m = {};
  try {
    m = JSON.parse(raw || '{}');
  } catch {
    throw new AppError('metadata must be JSON', 400);
  }
  const short = v => (typeof v === 'string' ? v.slice(0, 80) : null);
  return {
    engine: short(m.engine),
    modelConcerns: asList(m.modelConcerns),
    confirmedConcerns: asList(m.confirmedConcerns),
    userConfirmed: Boolean(m.userConfirmed),
    // Scores of our on-device model (the "student"), whichever engine produced modelConcerns.
    studentScores: scores(m.studentScores || m.modelScores),
    tone: short(m.tone),
    undertone: short(m.undertone),
    oiliness: short(m.oiliness),
    dosha: short(m.dosha),
    questionIds: asList(m.questionIds),
    answers: asList(m.answers),
  };
}

const hash = token => crypto.createHash('sha256').update(token).digest('hex');

router.get('/status', (req, res) => {
  res.json({ enabled: storage.isEnabled(), consentVersion: CONSENT_VERSION });
});

router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    if (!storage.isEnabled()) throw new AppError('Photo sharing is not enabled', 503);
    if (req.body.consent !== 'yes' || req.body.ageConfirmed !== 'yes') {
      throw new AppError('Consent and age confirmation are required', 400);
    }
    if (!req.file) throw new AppError('No image uploaded', 400);

    // Re-encoding drops all EXIF metadata (GPS location, device, time); rotate() applies the
    // orientation first so the stored photo is upright.
    const photo = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    const id = crypto.randomUUID();
    const deleteToken = crypto.randomBytes(24).toString('hex');
    const record = {
      id,
      createdAt: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
      ageConfirmed: true,
      deleteTokenHash: hash(deleteToken),
      ...cleanMetadata(req.body.metadata),
    };

    await storage.put(`contributions/${id}/photo.jpg`, photo, 'image/jpeg');
    await storage.put(`contributions/${id}/record.json`, Buffer.from(JSON.stringify(record, null, 2)), 'application/json');
    logger.info('Contribution stored', { id, confirmed: record.confirmedConcerns.length });

    res.status(201).json({ id, deleteToken });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!storage.isEnabled()) throw new AppError('Photo sharing is not enabled', 503);
    const { id } = req.params;
    const token = String(req.body?.token || req.query.token || '');
    if (!ID_PATTERN.test(id) || !token) throw new AppError('Invalid deletion request', 400);

    const raw = await storage.get(`contributions/${id}/record.json`);
    if (!raw) throw new AppError('Not found', 404);
    const expected = Buffer.from(JSON.parse(raw.toString()).deleteTokenHash, 'hex');
    const given = Buffer.from(hash(token), 'hex');
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
      throw new AppError('Invalid deletion code', 403);
    }

    await storage.remove(`contributions/${id}/photo.jpg`);
    await storage.remove(`contributions/${id}/record.json`);
    logger.info('Contribution deleted', { id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
