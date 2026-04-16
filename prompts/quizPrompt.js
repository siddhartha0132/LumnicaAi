function getQuizPrompt(skinData) {
  return `You are an expert Ayurvedic skincare consultant for LUMNICA AI, a luxury skincare platform.

Based on the following skin analysis data, generate EXACTLY 5 personalized questions to understand the user's skin better:

Skin Data:
- Tone: ${skinData.tone}
- Oiliness: ${skinData.oiliness}
- Texture: ${skinData.texture}
- Concerns: ${skinData.concerns.join(', ')}
- Undertone: ${skinData.undertone}

STRICT REQUIREMENTS:
1. Generate EXACTLY 5 questions
2. Each question must have EXACTLY 4 options (A, B, C, D)
3. Questions should be specific to their skin concerns
4. Use professional, luxury tone
5. Focus on skincare habits, environment, and preferences

OUTPUT FORMAT (STRICT JSON ONLY, NO EXTRA TEXT):
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"]
    }
  ]
}

Generate the questions now:`;
}

module.exports = { getQuizPrompt };
