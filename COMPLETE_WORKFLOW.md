# LUMNICA AI - Complete Workflow Documentation

## 🎯 Overview
LUMNICA AI is an Ayurvedic skincare platform that analyzes skin and provides personalized routines based on Dosha principles.

---

## 📋 Current Status: DEMO MODE ✅

The app is running in **DEMO MODE** with mock data because Gemini API has quota limits.

**Backend:** http://localhost:5000
**Frontend:** http://localhost:5000/index.html

---

## 🔄 Complete User Flow

### Step 1: Upload Photo 📸
**Endpoint:** `POST /api/analyzeSkin`

**What happens:**
- User uploads facial photo (JPG, PNG, AVIF - max 5MB)
- Backend receives image via multer
- **DEMO MODE:** Returns mock skin analysis
- **REAL MODE:** Gemini Vision API analyzes the image

**Request:**
```javascript
const formData = new FormData();
formData.append('image', photoFile);

fetch('http://localhost:5000/api/analyzeSkin', {
  method: 'POST',
  body: formData
})
```

**Response:**
```json
{
  "skinData": {
    "tone": "medium warm",
    "oiliness": "combination",
    "texture": "slightly uneven",
    "concerns": ["acne scars", "dark spots", "enlarged pores"],
    "undertone": "warm golden"
  }
}
```

---

### Step 2: Generate Personalized Quiz 📝
**Endpoint:** `POST /api/generateQuiz`

**What happens:**
- Frontend sends skinData from Step 1
- **DEMO MODE:** Returns 5 pre-defined questions
- **REAL MODE:** Gemini generates 5 dynamic questions based on skin concerns
- Backend adds 3 static Dosha detection questions
- Returns total 8 questions

**Request:**
```javascript
fetch('http://localhost:5000/api/generateQuiz', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    skinData: {
      tone: "medium warm",
      oiliness: "combination",
      texture: "slightly uneven",
      concerns: ["acne scars", "dark spots"],
      undertone: "warm golden"
    }
  })
})
```

**Response:**
```json
{
  "questions": [
    {
      "question": "How often do you experience breakouts or acne flare-ups?",
      "options": ["Daily", "2-3 times per week", "Once a week", "Rarely"]
    },
    {
      "question": "What is your current skincare routine like?",
      "options": ["Minimal", "Basic", "Moderate", "Extensive"]
    },
    // ... 3 more dynamic questions
    {
      "question": "What best describes your daily lifestyle?",
      "options": ["Active and fast-paced", "Intense and competitive", "Calm and steady", "Balanced"]
    },
    {
      "question": "Which dietary habits resonate with you most?",
      "options": ["Irregular meals", "Regular spicy meals", "Heavy meals", "Balanced diet"]
    },
    {
      "question": "How would you describe your sleep pattern?",
      "options": ["Light sleeper", "Moderate sleep", "Deep sleeper", "Variable"]
    }
  ]
}
```

---

### Step 3: User Answers Questions 🤔
**Frontend Action:**
- Display 8 questions
- User selects one option per question
- Store answers array: `["Daily", "Basic", "Very oily", ...]`

---

### Step 4: Get Complete Analysis 🎉
**Endpoint:** `POST /api/analyzeResults`

**What happens:**
- Frontend sends skinData + answers
- **DEMO MODE:** Returns pre-built Ayurvedic profile
- **REAL MODE:** Gemini analyzes everything and generates:
  - Dosha type determination
  - Personalized skincare routines
  - Product recommendations

**Request:**
```javascript
fetch('http://localhost:5000/api/analyzeResults', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    skinData: {
      tone: "medium warm",
      oiliness: "combination",
      texture: "slightly uneven",
      concerns: ["acne scars", "dark spots"],
      undertone: "warm golden"
    },
    answers: [
      "Daily",
      "Basic (cleanser + moisturizer)",
      "Very oily, especially T-zone",
      "More than 2 hours",
      "Yes, daily heavy makeup",
      "Active and fast-paced with irregular schedule",
      "Regular meals, prefer spicy and hot foods",
      "Moderate sleep, wake up easily"
    ]
  })
})
```

**Response:**
```json
{
  "dosha": {
    "type": "Pitta-Kapha",
    "description": "Your Pitta-Kapha constitution combines fire and earth elements..."
  },
  "skinProfile": {
    "tone": "medium warm",
    "type": "combination",
    "concerns": ["acne scars", "dark spots", "enlarged pores"],
    "undertone": "warm golden"
  },
  "routine": {
    "morning": [
      {
        "step": "Cleanse",
        "product": "Neem and Tulsi Face Wash",
        "reason": "Purifies without stripping natural oils"
      },
      {
        "step": "Tone",
        "product": "Rose Water Toner",
        "reason": "Cooling and soothing for Pitta"
      },
      {
        "step": "Serum",
        "product": "Vitamin C Serum with Turmeric",
        "reason": "Fades dark spots naturally"
      },
      {
        "step": "Moisturize",
        "product": "Aloe Vera Gel",
        "reason": "Lightweight hydration"
      },
      {
        "step": "Protect",
        "product": "Mineral Sunscreen SPF 50",
        "reason": "Prevents pigmentation"
      }
    ],
    "night": [
      {
        "step": "Double Cleanse",
        "product": "Coconut Oil + Neem Face Wash",
        "reason": "Removes impurities thoroughly"
      },
      {
        "step": "Exfoliate",
        "product": "Lactic Acid Toner (3x/week)",
        "reason": "Fades acne scars"
      },
      {
        "step": "Treatment",
        "product": "Kumkumadi Oil",
        "reason": "Traditional Ayurvedic brightening oil"
      },
      {
        "step": "Night Cream",
        "product": "Saffron Night Cream",
        "reason": "Repairs overnight"
      }
    ],
    "weekly": [
      {
        "step": "Face Mask",
        "product": "Multani Mitti + Rose Water (2x/week)",
        "reason": "Deep cleanses pores"
      },
      {
        "step": "Exfoliate",
        "product": "Chickpea Flour + Turmeric Scrub (1x/week)",
        "reason": "Natural exfoliation"
      }
    ]
  },
  "products": [
    {
      "name": "Kumkumadi Tailam Face Oil",
      "price": 1299,
      "benefit": "Reduces dark spots, brightens complexion"
    },
    {
      "name": "Neem & Tulsi Face Wash",
      "price": 249,
      "benefit": "Controls acne, purifies skin"
    },
    {
      "name": "Vitamin C Serum with Turmeric",
      "price": 899,
      "benefit": "Brightens skin, fades pigmentation"
    },
    {
      "name": "Saffron Night Cream",
      "price": 649,
      "benefit": "Repairs skin overnight"
    },
    {
      "name": "Rose Water Toner",
      "price": 199,
      "benefit": "Balances pH, minimizes pores"
    },
    {
      "name": "Multani Mitti Face Pack",
      "price": 149,
      "benefit": "Deep cleanses, controls oil"
    },
    {
      "name": "Aloe Vera Gel",
      "price": 299,
      "benefit": "Soothes inflammation"
    }
  ]
}
```

---

## 🎨 Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER OPENS APP                           │
│              http://localhost:5000                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Upload Facial Photo                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  User clicks/drags photo                             │   │
│  │  Frontend: FormData with image                       │   │
│  │  POST /api/analyzeSkin                               │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: Multer receives image                             │
│  DEMO MODE: Return mock skinData                            │
│  REAL MODE: Gemini Vision analyzes image                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Response: skinData                                         │
│  {                                                          │
│    tone: "medium warm",                                     │
│    oiliness: "combination",                                 │
│    concerns: ["acne scars", "dark spots"]                   │
│  }                                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Generate Quiz                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Frontend sends skinData                             │   │
│  │  POST /api/generateQuiz                              │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: Generate Questions                                │
│  DEMO MODE: Return 5 pre-defined questions                  │
│  REAL MODE: Gemini generates 5 dynamic questions            │
│  + Add 3 static Dosha questions                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Response: 8 Questions                                      │
│  [                                                          │
│    Q1-Q5: Dynamic (skin-specific)                           │
│    Q6: Lifestyle                                            │
│    Q7: Diet                                                 │
│    Q8: Sleep                                                │
│  ]                                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: User Answers Questions                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Display 8 questions                                 │   │
│  │  User selects options                                │   │
│  │  Store answers array                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Get Final Analysis                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Frontend sends skinData + answers                   │   │
│  │  POST /api/analyzeResults                            │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: Analyze Everything                                │
│  DEMO MODE: Return pre-built profile                        │
│  REAL MODE: Gemini analyzes skinData + answers              │
│  - Determine Dosha type                                     │
│  - Create routines (morning/night/weekly)                   │
│  - Recommend products                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Response: Complete Profile                                 │
│  {                                                          │
│    dosha: { type, description },                            │
│    skinProfile: { ... },                                    │
│    routine: { morning, night, weekly },                     │
│    products: [ ... ]                                        │
│  }                                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Display Results                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Show Dosha type                                     │   │
│  │  Display morning routine                             │   │
│  │  Display night routine                               │   │
│  │  Display weekly routine                              │   │
│  │  Show product recommendations with prices            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Architecture

### Backend Structure
```
backend/
├── server.js                 # Express server setup
├── routes/
│   ├── analyzeSkin.js       # Image upload & analysis
│   ├── generateQuiz.js      # Quiz generation
│   └── analyzeResults.js    # Final analysis
├── services/
│   └── geminiService.js     # Gemini API integration
├── prompts/
│   ├── skinAnalysisPrompt.js
│   ├── quizPrompt.js
│   └── analysisPrompt.js
├── utils/
│   └── validator.js         # Input validation
└── public/
    └── index.html           # Frontend UI
```

### Key Technologies
- **Backend:** Node.js + Express
- **AI:** Google Gemini API (gemini-2.5-flash)
- **File Upload:** Multer
- **Security:** Helmet, CORS, Rate Limiting
- **Frontend:** Vanilla JavaScript

---

## 🚀 How to Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# .env file
GEMINI_API_KEY=your_api_key_here
PORT=5000
```

### 3. Start Server
```bash
npm run dev
```

### 4. Open Browser
```
http://localhost:5000
```

---

## 🔄 Switching from DEMO to REAL MODE

When Gemini API quota is available, uncomment the real API code:

### In `routes/analyzeSkin.js`:
```javascript
// Uncomment this:
const imageBase64 = req.file.buffer.toString('base64');
const mimeType = req.file.mimetype;
const skinData = await analyzeSkinFromImage(imageBase64, mimeType);

// Comment out demo data
```

### In `routes/generateQuiz.js`:
```javascript
// Uncomment this:
const dynamicQuestions = await generateQuizQuestions(skinData);

// Comment out demo questions
```

### In `routes/analyzeResults.js`:
```javascript
// Uncomment this:
const analysis = await analyzeResults(skinData, answers);

// Comment out demo analysis
```

---

## 📊 API Endpoints Summary

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/api/analyzeSkin` | POST | Image file | skinData object |
| `/api/generateQuiz` | POST | skinData | 8 questions |
| `/api/analyzeResults` | POST | skinData + answers | Complete profile |

---

## ✅ Features

- ✅ Image upload with validation
- ✅ Skin analysis (tone, oiliness, texture, concerns)
- ✅ Dynamic quiz generation
- ✅ Dosha type determination
- ✅ Personalized morning routine
- ✅ Personalized night routine
- ✅ Weekly skincare routine
- ✅ Product recommendations with pricing
- ✅ Beautiful responsive UI
- ✅ Error handling
- ✅ Rate limiting
- ✅ Security headers
- ✅ DEMO mode for testing

---

## 🎯 Next Steps

1. **Wait for API quota reset** (usually 24 hours)
2. **Switch to REAL MODE** by uncommenting API calls
3. **Test with real Gemini responses**
4. **Deploy to production** (Vercel, Railway, etc.)
5. **Add user authentication** (optional)
6. **Save results to database** (optional)

---

## 📝 Notes

- Current mode: **DEMO** (mock data)
- API quota resets: Daily
- Free tier limits: Check https://ai.google.dev/gemini-api/docs/rate-limits
- Image size limit: 5MB
- Supported formats: JPG, PNG, AVIF, WebP

---

## 🐛 Troubleshooting

### Issue: 429 Too Many Requests
**Solution:** Wait for quota reset or use DEMO mode

### Issue: 503 Service Unavailable
**Solution:** Gemini API is overloaded, try again later or use DEMO mode

### Issue: Image not uploading
**Solution:** Check file size (<5MB) and format (JPG/PNG)

### Issue: CSP errors
**Solution:** Already fixed with Helmet configuration

---

**Created by:** Kiro AI Assistant
**Date:** 2026-04-16
**Status:** ✅ Fully Functional (DEMO MODE)
