const crypto = require('crypto');
const express = require('express');
const storage = require('../services/contributionStorage');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

const asList = value =>
  Array.isArray(value) ? value.filter(v => typeof v === 'string').slice(0, 20).map(v => v.slice(0, 80)) : [];

/**
 * 👍/👎 on the results page. No photo and nothing identifying: just whether the analysis was
 * right, what the model found and what the user confirmed. Comparing those two lists is the
 * live measure of how accurate the analysis is for real users.
 */
router.post('/', async (req, res, next) => {
  try {
    const { rating } = req.body || {};
    if (!['up', 'down'].includes(rating)) throw new AppError('rating must be "up" or "down"', 400);

    const entry = {
      at: new Date().toISOString(),
      rating,
      engine: typeof req.body.engine === 'string' ? req.body.engine.slice(0, 20) : null,
      modelConcerns: asList(req.body.modelConcerns),
      confirmedConcerns: asList(req.body.confirmedConcerns),
      userConfirmed: Boolean(req.body.userConfirmed),
      dosha: typeof req.body.dosha === 'string' ? req.body.dosha.slice(0, 40) : null,
    };
    logger.info('Feedback', entry);

    if (storage.isEnabled()) {
      const day = entry.at.slice(0, 10);
      await storage.put(`feedback/${day}/${crypto.randomUUID()}.json`, Buffer.from(JSON.stringify(entry)), 'application/json');
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
