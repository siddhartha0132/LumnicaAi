# LUMNICA AI - Complete Workflow

## Full User Journey (Photo to Output)

### Step 1: Upload Photo
```
Frontend → POST /api/analyzeSkin
- User uploads facial photo
- Backend receives image (multipart/form-data)
- Gemini Vision API analyzes the image
- Returns skinData object
```

**Example Request:**
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

### Step 2: Generate Personalized Quiz
```
Frontend → POST /api/generateQuiz
- Send skinData from Step 1
- Backend generates 5 dynamic questions based on skin analysis
- Backend adds 3 static Dosha questions
- Returns 8 total questions
```

**Example Request:**
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
      "question": "How often do you experience breakouts?",
      "options": ["Daily", "Weekly", "Monthly", "Rarely"]
    },
    {
      "question": "What is your current skincare routine?",
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

### Step 3: User Answers Questions
```
Frontend displays 8 questions
User selects answers: ["A", "B", "C", "D", "A", "B", "C", "D"]
```

---

### Step 4: Get Complete Analysis
```
Frontend → POST /api/analyzeResults
- Send skinData + user answers
- Gemini analyzes everything together
- Determines Dosha type
- Creates personalized skincare profile
- Generates routines and product recommendations
```

**Example Request:**
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
    answers: ["A", "B", "C", "D", "A", "B", "C", "D"]
  })
})
```

**Response:**
```json
{
  "dosha": {
    "type": "Pitta-Kapha",
    "description": "Your Pitta-Kapha constitution combines fire and earth elements. This manifests as combination skin with oily T-zone and tendency for inflammation. Your skin benefits from cooling, balancing ingredients."
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
        "reason": "Purifies without stripping natural oils, balances combination skin"
      },
      {
        "step": "Tone",
        "product": "Rose Water Toner",
        "reason": "Cooling and soothing for Pitta, minimizes pores"
      },
      {
        "step": "Serum",
        "product": "Vitamin C Serum with Turmeric",
        "reason": "Fades dark spots and brightens complexion"
      },
      {
        "step": "Moisturize",
        "product": "Aloe Vera Gel",
        "reason": "Lightweight hydration for combination skin"
      },
      {
        "step": "Protect",
        "product": "Mineral Sunscreen SPF 50",
        "reason": "Prevents further pigmentation"
      }
    ],
    "night": [
      {
        "step": "Double Cleanse",
        "product": "Coconut Oil + Neem Face Wash",
        "reason": "Removes impurities and makeup thoroughly"
      },
      {
        "step": "Exfoliate",
        "product": "Lactic Acid Toner (3x/week)",
        "reason": "Gently resurfaces skin, fades acne scars"
      },
      {
        "step": "Treatment",
        "product": "Kumkumadi Oil",
        "reason": "Traditional Ayurvedic oil for brightening and healing"
      },
      {
        "step": "Night Cream",
        "product": "Saffron Night Cream",
        "reason": "Repairs and rejuvenates overnight"
      }
    ],
    "weekly": [
      {
        "step": "Face Mask",
        "product": "Multani Mitti + Rose Water (2x/week)",
        "reason": "Deep cleanses pores, controls oil, brightens skin"
      },
      {
        "step": "Exfoliate",
        "product": "Chickpea Flour + Turmeric Scrub (1x/week)",
        "reason": "Natural exfoliation, evens skin tone"
      }
    ]
  },
  "products": [
    {
      "name": "Kumkumadi Tailam Face Oil",
      "price": 1299,
      "benefit": "Reduces dark spots, brightens complexion, fades acne scars"
    },
    {
      "name": "Neem & Tulsi Face Wash",
      "price": 249,
      "benefit": "Controls acne, purifies combination skin"
    },
    {
      "name": "Vitamin C Serum with Turmeric",
      "price": 899,
      "benefit": "Brightens skin, fades pigmentation"
    },
    {
      "name": "Saffron Night Cream",
      "price": 649,
      "benefit": "Repairs skin overnight, improves texture"
    },
    {
      "name": "Rose Water Toner",
      "price": 199,
      "benefit": "Balances pH, minimizes pores, cooling effect"
    },
    {
      "name": "Multani Mitti Face Pack",
      "price": 149,
      "benefit": "Deep cleanses, controls oil, brightens"
    }
  ]
}
```

---

## Complete Flow Diagram

```
┌─────────────────┐
│  User uploads   │
│  facial photo   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ POST /api/analyzeSkin   │
│ (Gemini Vision API)     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Returns skinData       │
│  (tone, concerns, etc)  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ POST /api/generateQuiz  │
│ (with skinData)         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Returns 8 questions    │
│  (5 dynamic + 3 static) │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  User answers all 8     │
│  questions              │
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────┐
│ POST /api/analyzeResults │
│ (skinData + answers)     │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Complete Profile:       │
│  - Dosha type            │
│  - Skin profile          │
│  - Morning routine       │
│  - Night routine         │
│  - Weekly routine        │
│  - Product recommendations│
└──────────────────────────┘
```

## Testing the API

### 1. Test Image Analysis
```bash
curl -X POST http://localhost:5000/api/analyzeSkin \
  -F "image=@/path/to/face-photo.jpg"
```

### 2. Test Quiz Generation
```bash
curl -X POST http://localhost:5000/api/generateQuiz \
  -H "Content-Type: application/json" \
  -d '{
    "skinData": {
      "tone": "medium warm",
      "oiliness": "combination",
      "texture": "slightly uneven",
      "concerns": ["acne scars", "dark spots"],
      "undertone": "warm golden"
    }
  }'
```

### 3. Test Final Analysis
```bash
curl -X POST http://localhost:5000/api/analyzeResults \
  -H "Content-Type: application/json" \
  -d '{
    "skinData": {
      "tone": "medium warm",
      "oiliness": "combination",
      "texture": "slightly uneven",
      "concerns": ["acne scars", "dark spots"],
      "undertone": "warm golden"
    },
    "answers": ["A", "B", "C", "D", "A", "B", "C", "D"]
  }'
```
