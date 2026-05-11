# LUMNICA AI Backend

Production-ready Node.js backend for AI-powered Ayurvedic skincare personalization platform. Analyzes facial photos and quiz responses to provide personalized dosha determination, skincare routines, and product recommendations using Ayurvedic principles.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
npm run dev
```

**Server runs at:** `http://localhost:5001`

---

## API Endpoints

### GET /api/health
Health check. Returns server status and uptime.

### POST /api/analyzeSkin
Analyzes skin from uploaded facial photo (multiply form-data).

| Field | Type | Description |
|-------|------|-------------|
| image | file | JPEG/PNG/WEBP, max 5MB |

**Response:**
```json
{
  "skinData": {
    "tone": "tan warm",
    "fitzpatrickType": "IV",
    "approximateHex": "#C68642",
    "oiliness": "combination",
    "texture": "slightly uneven",
    "concerns": ["enlarged pores", "mild acne"],
    "undertone": "warm golden"
  }
}
```

### POST /api/generateQuiz
Generates 8 personalized quiz questions (5 AI + 3 dosha).

**Request:**
```json
{ "skinData": { "tone": "medium", "oiliness": "oily", "undertone": "warm" } }
```

**Response:**
```json
{
  "questions": [
    { "question": "How often do you experience breakouts?", "options": ["Daily", "Weekly", "Rarely", "Never"] }
  ]
}
```

### POST /api/analyzeResults
Returns complete Ayurvedic profile with dosha, routines, and products.

**Request:**
```json
{
  "skinData": { "tone": "medium warm", "oiliness": "combination" },
  "answers": ["Daily", "Basic routine", "Oily T-zone", "4-6 hours", "Never", "Active", "Spicy foods", "Deep sleeper"]
}
```

**Response:**
```json
{
  "dosha": { "type": "Pitta-Kapha", "description": "Your constitution combines fire and earth elements..." },
  "skinProfile": { "tone": "medium warm", "type": "combination", "concerns": ["acne", "dark spots"], "undertone": "warm golden" },
  "routine": {
    "morning": [{ "step": "Cleanse", "product": "Neem & Tulsi Face Wash", "reason": "Purifies without stripping" }],
    "night": [{ "step": "Cleanse", "product": "Kumkumadi Oil", "reason": "Traditional brightening" }],
    "weekly": [{ "step": "Mask", "product": "Multani Mitti Pack", "reason": "Deep cleanses pores" }]
  },
  "products": [
    { "name": "Kumkumadi Tailam Face Oil", "price": 1299, "benefit": "Reduces dark spots" }
  ],
  "doshaInsights": "Drink cooling herbal teas. Avoid spicy foods. Sleep before 10pm."
}
```

---

## Configuration

All configuration is via `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | required | Google AI API key (free tier) |
| `NVIDIA_API_KEY` | optional | NVIDIA NIM API key (free tier) |
| `DEMO_MODE` | false | Use mock data without API keys |
| `PORT` | 5001 | Server port |
| `LOG_LEVEL` | debug | Logging verbosity |
| `RATE_LIMIT_MAX` | 100 | Requests per 15 minutes |
| `MAX_FILE_SIZE` | 5242880 | Max upload size in bytes |
| `ML_CONFIDENCE_THRESHOLD` | 0.65 | Min confidence for on-device ML |

---

## Architecture

```
public/
├── index.html          # Main frontend
└── ml-engine.js         # On-device skin analysis (no MediaPipe)

routes/
├── analyzeSkin.js       # POST /api/analyzeSkin
├── analyzeSkinML.js     # POST /api/analyzeSkinML
├── generateQuiz.js      # POST /api/generateQuiz
└── analyzeResults.js    # POST /api/analyzeResults

services/
├── geminiService.js     # Google Gemini API
├── nvidiaService.js     # NVIDIA NIM API (optional)
└── productService.js    # Curated product matching

config/
├── index.js             # Centralized configuration
└── skinConstants.js     # ML thresholds for all Fitzpatrick types

data/
└── products.json        # 26 curated Indian Ayurvedic products
```

## Features

- **Dual AI Support**: Gemini (primary) or NVIDIA NIM (optional)
- **On-Device ML**: Pixel analysis runs in-browser, no external dependencies
- **Curated Products**: 26 real Indian Ayurvedic products (no hallucinations)
- **Indian Skin Optimized**: Fitzpatrick III-VI thresholds calibrated for Indian skin tones
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Security**: Helmet headers, CORS, file type validation
- **Stateless**: No database, no image storage

---

## Testing Without API Keys

```bash
DEMO_MODE=true npm run dev
```

All endpoints return realistic mock data.