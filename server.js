require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const analyzeSkinRoute = require('./routes/analyzeSkin');
const analyzeSkinMLRoute = require('./routes/analyzeSkinML');
const generateQuizRoute = require('./routes/generateQuiz');
const analyzeResultsRoute = require('./routes/analyzeResults');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
    }
  }
}));

app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => config.rateLimit.skipHealthCheck && req.path === '/api/health',
  message: { success: false, error: { message: 'Too many requests, please try again later.' } },
});

app.use('/api/', limiter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
  });
});

app.use('/api/analyzeSkin', analyzeSkinRoute);
app.use('/api/analyzeSkinML', analyzeSkinMLRoute);
app.use('/api/generateQuiz', generateQuizRoute);
app.use('/api/analyzeResults', analyzeResultsRoute);

app.use(errorHandler);

const { host, port } = config.server;
app.listen(port, host, () => {
  logger.info(`LUMNICA AI Backend started on ${host}:${port}`);
  if (!config.providers.gemini.apiKey) {
    logger.warn('GEMINI_API_KEY not set — running in DEMO_MODE');
  }
  if (!config.providers.nvidia.apiKey) {
    logger.warn('NVIDIA_API_KEY not set — NVIDIA NIM disabled');
  }
});

module.exports = app;