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
  const nvidiaOk =
    !!process.env.NVIDIA_API_KEY_TEXT &&
    !!process.env.NVIDIA_API_KEY_VISION &&
    !!process.env.NVIDIA_API_KEY_VISION_FALLBACK;

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    providers: {
      nvidia_text:            !!process.env.NVIDIA_API_KEY_TEXT,
      nvidia_vision:          !!process.env.NVIDIA_API_KEY_VISION,
      nvidia_vision_fallback: !!process.env.NVIDIA_API_KEY_VISION_FALLBACK,
    },
    models: {
      text:           process.env.NVIDIA_MODEL            || 'meta/llama-4-maverick-17b-128e-instruct',
      vision:         process.env.NVIDIA_VISION_MODEL     || 'meta/llama-3.2-90b-vision-instruct',
      vision_fallback:process.env.NVIDIA_VISION_FALLBACK_MODEL || 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
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
  console.log(`\n🚀 LUMNICA AI Backend running on port ${PORT}`);
  console.log(`\n📡 NVIDIA NIM Models:`);
  console.log(`   Text Model:     ${process.env.NVIDIA_MODEL || 'meta/llama-4-maverick-17b-128e-instruct'} ${process.env.NVIDIA_API_KEY_TEXT ? '✅' : '❌'}`);
  console.log(`   Vision Model:   ${process.env.NVIDIA_VISION_MODEL || 'meta/llama-3.2-90b-vision-instruct'} ${process.env.NVIDIA_API_KEY_VISION ? '✅' : '❌'}`);
  console.log(`   Vision Fallback:${process.env.NVIDIA_VISION_FALLBACK_MODEL || 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1'} ${process.env.NVIDIA_API_KEY_VISION_FALLBACK ? '✅' : '❌'}`);
  console.log(`\n   Demo mode: ${process.env.DEMO_MODE}\n`);
});
