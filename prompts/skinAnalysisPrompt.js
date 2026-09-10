/**
 * Skin analysis prompt optimized for Llama 3.2 11B Vision on NVIDIA NIM.
 * Explicitly forbids "unknown" — forces the model to always describe what it sees.
 */
function getSkinAnalysisPrompt() {
  return `You are a clinical dermatologist. Look carefully at the face in this image and analyze the skin.

CRITICAL RULES:
- You MUST describe what you actually see. NEVER use "unknown" — always give your best observation.
- If lighting is dim, describe what you can still see (e.g. "medium brown tone under dim light").
- Output ONLY raw JSON — no markdown, no code fences, no explanation.

Use EXACTLY this JSON structure:
{"skinData":{"tone":"specific shade e.g. light beige, medium brown, deep brown","oiliness":"T-zone: X/10, Cheeks: Y/10","texture":"describe pores, smoothness, bumps, fine lines","concerns":["visible issue 1","visible issue 2"],"undertone":"warm/cool/neutral/olive"},"imageConfidence":"high/medium/low"}

Rules for each field:
- tone: specific color description, NEVER "unknown". E.g. "light beige with pink tint", "medium caramel with yellow undertone"
- oiliness: T-zone/Cheeks X/10 format. Use 0-3 for dry, 4-6 for normal, 7-10 for oily
- texture: specific e.g. "smooth with slightly enlarged pores on nose", NEVER "unknown"
- concerns: array of strings. Use ["none visible"] only if skin is perfectly clear
- undertone: MUST be one of: warm, cool, neutral, olive
- imageConfidence: high = face clearly visible, medium = partially visible or low light, low = face not visible at all

Output ONLY the JSON. Nothing else.`;
}

function getSkinAnalysisFallbackPrompt(partialMLData) {
  return `You are a clinical dermatologist analyzing a patient photo. Study the SPECIFIC image provided.

On-device ML hints (verify against the actual image, do not blindly trust):
${JSON.stringify(partialMLData, null, 2)}

Analyze ONLY what you SEE in THIS specific photograph. Be specific, not generic.
NEVER use "unknown" — always give your best clinical observation based on what is visible.

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
