// services/claudeService.js
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-20250514';

async function generateQuizQuestionsWithClaude(skinData) {
  const prompt = `You are an expert Ayurvedic skin consultant. Based on the following skin analysis data, generate exactly 5 targeted quiz questions to help personalize the skincare routine.

Skin analysis:
${JSON.stringify(skinData, null, 2)}

Return ONLY a valid JSON array of 5 question objects. No preamble, no markdown, no explanation. Format:
[
  {
    "question": "question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"]
  }
]

Make questions specific to the detected skin concerns. Questions should cover: frequency of issues, current routine, triggers, water intake, sun exposure.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function analyzeResultsWithClaude(skinData, answers, questions) {
  const prompt = `You are a certified Ayurvedic practitioner and skincare expert. Analyze the following skin profile and questionnaire responses to provide a complete personalized Ayurvedic skincare plan.

SKIN DATA:
${JSON.stringify(skinData, null, 2)}

QUESTIONNAIRE:
${questions.map((q, i) => `Q${i+1}: ${q.question}\nA: ${answers[i] || 'not answered'}`).join('\n\n')}

Respond ONLY with a valid JSON object. No preamble, no markdown. Structure:
{
  "dosha": {
    "type": "Vata|Pitta|Kapha|Vata-Pitta|Pitta-Kapha|Vata-Kapha|Tridoshic",
    "description": "2-3 sentence explanation of this constitution and what it means for their skin"
  },
  "skinProfile": {
    "tone": "string",
    "type": "dry|oily|combination|normal|sensitive",
    "concerns": ["array", "of", "concerns"],
    "undertone": "string"
  },
  "routine": {
    "morning": [{ "step": "step name", "product": "specific product name", "reason": "Ayurvedic reason" }],
    "night": [{ "step": "step name", "product": "specific product name", "reason": "Ayurvedic reason" }],
    "weekly": [{ "step": "step name", "product": "specific product name", "reason": "Ayurvedic reason" }]
  },
  "products": [{ "name": "product name", "price": 299, "benefit": "key benefit" }],
  "doshaInsights": "2-3 sentences of personalised Ayurvedic lifestyle advice beyond skincare"
}

Provide 4-5 morning steps, 3-4 night steps, 2-3 weekly steps. Products array should have 6-8 items with realistic Indian market prices in INR. Use authentic Ayurvedic ingredients (neem, turmeric, kumkumadi, rose water, multani mitti, etc.).`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

module.exports = { generateQuizQuestionsWithClaude, analyzeResultsWithClaude };
