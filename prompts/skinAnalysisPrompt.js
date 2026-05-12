/**
 * Skin analysis prompt optimized for Llama Vision models on NVIDIA NIM.
 * Returns structured JSON with unique, image-specific analysis.
 */
function getSkinAnalysisPrompt() {
  return `Analyze the skin in this photo and respond with ONLY a JSON object — no explanation, no markdown, no code fences, just raw JSON.

Use this exact structure:
{"skinData":{"tone":"describe shade and evenness","oiliness":"T-zone: X/10, Cheeks: Y/10","texture":"describe pores, smoothness, bumps","concerns":["issue1","issue2"],"undertone":"warm/cool/neutral/olive"},"imageConfidence":"high/medium/low"}

Rules:
- tone: specific color description e.g. "light beige with pink cheeks"
- oiliness: use the T-zone/Cheeks X/10 format strictly
- concerns: array of strings, use ["none visible"] if nothing notable
- undertone: one of warm, cool, neutral, olive
- imageConfidence: high if face is clear, medium if partially visible, low if unclear
- Output ONLY the JSON. No other text before or after.`;
}

function getSkinAnalysisFallbackPrompt(partialMLData) {
  return `You are a clinical dermatologist analyzing a patient photo. Study the SPECIFIC image provided.

On-device ML hints (verify against the actual image, do not blindly trust):
${JSON.stringify(partialMLData, null, 2)}

Analyze ONLY what you SEE in THIS specific photograph. Be specific, not generic.

Return ONLY this JSON:
{
  "skinData": {
    "tone": "specific description of what you see",
    "oiliness": "T-zone: X/10, Cheeks: Y/10",
    "texture": "specific visible features from this image",
    "concerns": ["specific visible issue 1", "specific visible issue 2"],
    "undertone": "warm/cool/neutral/olive"
  },
  "imageConfidence": "high/medium/low"
}`;
}

module.exports = { getSkinAnalysisPrompt, getSkinAnalysisFallbackPrompt };
