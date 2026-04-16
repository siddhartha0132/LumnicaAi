# LUMNICA AI Backend

Production-ready Node.js backend for AI-powered Ayurvedic skincare platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your Gemini API key to `.env`:
```
GEMINI_API_KEY=your_actual_api_key
PORT=5000
```

4. Run the server:
```bash
npm run dev
```

## API Endpoints

### POST /api/analyzeSkin
Analyze skin from uploaded image using Gemini Vision API.

**Request:**
- Content-Type: multipart/form-data
- Body: image file (max 5MB)

**Response:**
```json
{
  "skinData": {
    "tone": "medium warm",
    "oiliness": "combination",
    "texture": "slightly uneven",
    "concerns": ["acne scars", "dark spots"],
    "undertone": "warm golden"
  }
}
```

### POST /api/generateQuiz
Generate personalized quiz questions based on skin data.

**Request:**
```json
{
  "skinData": {
    "tone": "medium warm",
    "oiliness": "high",
    "texture": "uneven",
    "concerns": ["acne", "dark spots"],
    "undertone": "warm golden"
  }
}
```

**Response:**
```json
{
  "questions": [
    {
      "question": "Question text?",
      "options": ["A", "B", "C", "D"]
    }
  ]
}
```

### POST /api/analyzeResults
Analyze quiz results and generate Ayurvedic skincare profile.

**Request:**
```json
{
  "skinData": { ... },
  "answers": ["A", "B", "C", "D", "A", "B", "C", "D"]
}
```

**Response:**
```json
{
  "dosha": {
    "type": "Pitta-Vata",
    "description": "..."
  },
  "skinProfile": { ... },
  "routine": { ... },
  "products": [ ... ]
}
```

## Features

- 100% Stateless
- No database or image storage
- Rate limiting
- Input validation
- Error handling
- Security headers (Helmet)
- CORS enabled
# LumnicaAi
