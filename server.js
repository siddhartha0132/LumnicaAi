require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');

const analyzeSkinRoute = require('./routes/analyzeSkin');
const analyzeSkinMLRoute = require('./routes/analyzeSkinML');
const generateQuizRoute = require('./routes/generateQuiz');
const analyzeResultsRoute = require('./routes/analyzeResults');

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://integrate.api.nvidia.com", "https://generativelanguage.googleapis.com"],
    }
  }
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Trust Render's reverse proxy so express-rate-limit can correctly
// identify users via X-Forwarded-For (required on Render, Heroku, etc.)
app.set('trust proxy', 1);

// Rate limiter for API routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Health check (no rate limiting)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    providers: {
      gemini: !!process.env.GEMINI_API_KEY,
      nvidia: !!process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== 'your_nvidia_api_key_here',
    }
  });
});

// API routes
app.use('/api/analyzeSkin', analyzeSkinRoute);
app.use('/api/analyzeSkinML', analyzeSkinMLRoute);
app.use('/api/generateQuiz', generateQuizRoute);
app.use('/api/analyzeResults', analyzeResultsRoute);

// Global error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`LUMNICA AI Backend running on port ${PORT}`);
  console.log(`Gemini API: ${process.env.GEMINI_API_KEY ? '✅ configured' : '❌ missing'}`);
  console.log(`NVIDIA API: ${process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== 'your_nvidia_api_key_here' ? '✅ configured' : '❌ missing'}`);
  console.log(`Demo mode: ${process.env.DEMO_MODE}`);
});
