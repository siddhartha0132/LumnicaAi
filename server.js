require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const analyzeSkinRoute = require('./routes/analyzeSkin');
const analyzeSkinMLRoute = require('./routes/analyzeSkinML');
const generateQuizRoute = require('./routes/generateQuiz');
const analyzeResultsRoute = require('./routes/analyzeResults');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

app.use('/api/', limiter);

// Health check endpoint (no rate limiting)
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api/analyzeSkin', analyzeSkinRoute);
app.use('/api/analyzeSkinML', analyzeSkinMLRoute);
app.use('/api/generateQuiz', generateQuizRoute);
app.use('/api/analyzeResults', analyzeResultsRoute);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`LUMNICA AI Backend running on port ${PORT}`);
});
