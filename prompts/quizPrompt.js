function getQuizPrompt(skinData) {
  // Extract all available data from skinData
  const tone = skinData.tone || 'unknown';
  const fitzpatrick = skinData.fitzpatrickType || skinData.fitzpatrick?.type || 'unknown';
  const hex = skinData.approximateHex || skinData.fitzpatrick?.hexRange || 'unknown';
  const oiliness = skinData.oiliness || skinData.oiliness?.overall || 'unknown';
  const texture = skinData.texture || skinData.texture?.overall || 'unknown';
  const undertone = skinData.undertone || skinData.fitzpatrick?.undertone || 'unknown';
  
  // Handle concerns array
  let concerns = 'none';
  if (Array.isArray(skinData.concerns)) {
    concerns = skinData.concerns.join(', ');
  } else if (skinData.concerns && Array.isArray(skinData.concerns)) {
    concerns = skinData.concerns.map(c => c.name || c).join(', ');
  }

  return `You are an expert Ayurvedic skincare consultant for LUMNICA AI, a luxury skincare platform.

Based on the following DETAILED skin analysis data, generate EXACTLY 5 highly personalized questions to understand the user's skin better and determine their Ayurvedic dosha:

DETAILED SKIN ANALYSIS:
- Skin Tone: ${tone}
- Fitzpatrick Type: ${fitzpatrick}
- Approximate Hex Color: ${hex}
- Oiliness Level: ${oiliness}
- Skin Texture: ${texture}
- Skin Concerns: ${concerns}
- Undertone: ${undertone}

STRICT REQUIREMENTS:
1. Generate EXACTLY 5 questions (no more, no less)
2. Each question must have EXACTLY 4 options (A, B, C, D)
3. Questions MUST be highly specific to their ACTUAL skin concerns (${concerns})
4. Questions MUST address their specific skin type (${oiliness} oiliness, ${texture} texture)
5. Use professional, luxury tone appropriate for high-end skincare
6. Focus on: skincare habits, environmental factors, lifestyle, product preferences, and specific concern management
7. Make questions actionable and relevant to creating a personalized Ayurvedic routine

EXAMPLES OF GOOD QUESTIONS (adapt to their specific profile):
- For acne concerns: "How do you currently manage breakouts when they occur?"
- For dry skin: "How does your skin feel by midday in terms of hydration?"
- For oily skin: "How often do you need to blot or refresh your T-zone during the day?"
- For dark spots: "What has been your primary approach to addressing hyperpigmentation?"
- For fine lines: "Which areas of your face show the earliest signs of aging?"

OUTPUT FORMAT (STRICT JSON ONLY, NO MARKDOWN, NO EXTRA TEXT):
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"]
    }
  ]
}

Generate the 5 personalized questions now:`;
}

module.exports = { getQuizPrompt };
