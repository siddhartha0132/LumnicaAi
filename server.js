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
      connectSrc: ["'self'", "https://integrate.api.nvidia.com"],
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

// Health check
app.get('/api/health', (req, res) => {
  const nvidiaOk = !!process.env.NVIDIA_API_KEY;

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    providers: {
      nvidia: nvidiaOk,
    },
    models: {
      active: process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    },
    allConfigured: nvidiaOk,
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
  const model = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
  const keySet = !!process.env.NVIDIA_API_KEY;
  console.log(`\n🚀 LUMNICA AI Backend running on port ${PORT}`);
  console.log(`\n📡 NVIDIA NIM:`);
  console.log(`   Model:  ${model} ${keySet ? '✅' : '❌ NVIDIA_API_KEY not set'}`);
  console.log(`\n   Demo mode: ${process.env.DEMO_MODE}\n`);
});

// Export for Vercel serverless
module.exports = app;
