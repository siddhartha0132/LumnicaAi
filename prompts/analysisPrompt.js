function getAnalysisPrompt(skinData, answers) {
  return `You are an expert Ayurvedic skincare consultant for LUMNICA AI, a luxury Ayurvedic skincare platform.

Analyze the following data and provide a comprehensive Ayurvedic skincare profile:

SKIN DATA:
- Tone: ${skinData.tone}
- Oiliness: ${skinData.oiliness}
- Texture: ${skinData.texture}
- Concerns: ${skinData.concerns.join(', ')}
- Undertone: ${skinData.undertone}

USER ANSWERS (8 questions):
${answers.map((ans, idx) => `Q${idx + 1}: ${ans}`).join('\n')}

Note: Questions 6-8 are for Dosha detection (lifestyle, diet, sleep patterns).

TASK:
1. Determine the user's Dosha type (Vata, Pitta, Kapha, or combination like Pitta-Vata)
2. Create a complete skin profile
3. Design morning, night, and weekly Ayurvedic skincare routines
4. Recommend 5-7 Ayurvedic products with realistic Indian pricing (₹200-₹2000 range)

STRICT OUTPUT FORMAT (JSON ONLY, NO EXTRA TEXT):
{
  "dosha": {
    "type": "Pitta-Vata",
    "description": "Detailed description of this dosha combination and how it affects skin"
  },
  "skinProfile": {
    "tone": "medium warm",
    "type": "combination",
    "concerns": ["acne", "dark spots"],
    "undertone": "warm golden"
  },
  "routine": {
    "morning": [
      {
        "step": "Cleanse",
        "product": "Gentle Ayurvedic cleanser with neem",
        "reason": "Removes impurities without stripping natural oils"
      }
    ],
    "night": [
      {
        "step": "Double Cleanse",
        "product": "Oil-based cleanser followed by herbal wash",
        "reason": "Deep cleansing for acne-prone skin"
      }
    ],
    "weekly": [
      {
        "step": "Exfoliate",
        "product": "Turmeric and chickpea flour scrub",
        "reason": "Brightens and evens skin tone"
      }
    ]
  },
  "products": [
    {
      "name": "Kumkumadi Face Oil",
      "price": 1299,
      "benefit": "Reduces dark spots and brightens complexion"
    },
    {
      "name": "Neem Face Wash",
      "price": 249,
      "benefit": "Controls acne and purifies skin"
    }
  ],
  "doshaInsights": "2-3 sentences of personalized Ayurvedic lifestyle advice beyond skincare (diet, sleep, stress management, etc.)"
}

Provide the analysis now:`;
}

module.exports = { getAnalysisPrompt };
