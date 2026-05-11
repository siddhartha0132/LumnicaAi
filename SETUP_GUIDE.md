# LUMNICA AI - Setup Guide (Gemini FREE Version) 🚀

## ✅ What's Configured

Your LUMNICA AI platform now uses **Google Gemini API** (100% FREE) as the primary AI backend:

- ✅ **Image Analysis**: Gemini Vision API analyzes facial photos
- ✅ **Quiz Generation**: Gemini creates personalized questions
- ✅ **Dosha Analysis**: Gemini determines Ayurvedic constitution
- ✅ **Routine Creation**: Gemini generates personalized skincare routines
- ✅ **Lifestyle Advice**: Gemini provides doshaInsights

## 🆓 Get Your FREE Gemini API Key

### Step 1: Visit Google AI Studio
Go to: **https://aistudio.google.com/app/apikey**

### Step 2: Sign in with Google Account
Use any Google account (Gmail)

### Step 3: Create API Key
- Click "Create API Key"
- Select "Create API key in new project" (or use existing)
- Copy the key (starts with `AIza...`)

### Step 4: Add to .env File

Create a `.env` file in your project root:

```bash
# Required - FREE Gemini API
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Set to false for production
DEMO_MODE=false

# Server config
PORT=5001
NODE_ENV=production
```

## 🚀 Start the Server

```bash
npm start
```

Open browser: **http://localhost:5001**

## 📋 How It Works

1. **Upload Photo** → Gemini Vision analyzes skin (tone, texture, concerns)
2. **Answer Quiz** → Gemini generates 5 personalized questions + 3 Dosha questions
3. **Get Results** → Gemini creates:
   - Dosha type (Vata/Pitta/Kapha)
   - Morning/Night/Weekly routines
   - Product recommendations
   - Lifestyle advice (NEW!)

## 🎯 Gemini Free Tier Limits

- **60 requests per minute**
- **1,500 requests per day**
- **1 million tokens per month**

This is MORE than enough for testing and small-scale production!

## 🔄 Alternative Options (If Needed)

### Option 1: Demo Mode (No API Key)
Set in `.env`:
```bash
DEMO_MODE=true
```
Uses hardcoded mock data for testing UI.

### Option 2: Hugging Face (FREE - Image Only)
For image analysis only:
```bash
HF_API_KEY=hf_xxxxxxxxxxxxx
```
Then uncomment HF code in `routes/analyzeSkin.js`

### Option 3: Claude (PAID - Premium)
For premium AI quality:
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```
Then uncomment Claude code in routes.

## 🧪 Test the System

### Test 1: Demo Mode
```bash
# In .env
DEMO_MODE=true

# Start server
npm start

# Upload any photo → Should get instant mock results
```

### Test 2: Real Gemini Mode
```bash
# In .env
DEMO_MODE=false
GEMINI_API_KEY=AIzaSy...

# Start server
npm start

# Upload a clear facial photo → Should get AI analysis
```

## 🐛 Troubleshooting

### Error: "GEMINI_API_KEY not configured"
- Check `.env` file exists in project root
- Verify key starts with `AIza`
- Restart server after adding key

### Error: "Failed to analyze image"
- Check image is under 5MB
- Use JPG or PNG format
- Ensure good lighting in photo
- Check Gemini API quota not exceeded

### Error: "No valid JSON found in response"
- Gemini sometimes adds extra text
- The code extracts JSON automatically
- If persists, check Gemini API status

## 📁 Project Structure

```
LUMNICA AI/
├── services/
│   ├── geminiService.js       ✅ PRIMARY (FREE)
│   ├── huggingFaceService.js  ⚪ Alternative (FREE)
│   └── claudeService.js       ⚪ Alternative (PAID)
├── routes/
│   ├── analyzeSkin.js         → Uses Gemini Vision
│   ├── generateQuiz.js        → Uses Gemini Text
│   └── analyzeResults.js      → Uses Gemini Text
├── prompts/
│   ├── skinAnalysisPrompt.js  → Image analysis prompt
│   ├── quizPrompt.js          → Quiz generation prompt
│   └── analysisPrompt.js      → Dosha analysis prompt (with doshaInsights)
└── public/
    └── index.html             → Frontend (updated with doshaInsights)
```

## ✨ New Features Added

1. **doshaInsights** - Lifestyle advice beyond skincare
2. **questions array** - Passed to backend for context
3. **Gemini as primary** - No paid APIs required
4. **Easy switching** - Comment/uncomment to change AI backend

## 🎉 You're Ready!

Just add your Gemini API key and start the server. Everything else is configured!

```bash
# 1. Get key from: https://aistudio.google.com/app/apikey
# 2. Add to .env file
# 3. npm start
# 4. Open http://localhost:5001
```

Enjoy your FREE AI-powered Ayurvedic skincare platform! 🌿✨
