function getSkinAnalysisPrompt() {
  return `Analyze this face photo and return ONLY a JSON object. No markdown, no explanation.

Look at the ACTUAL pixels in the image. Do NOT use generic defaults.

Return this exact JSON structure:
{
  "tone": "describe what you actually see, e.g. 'light warm beige' or 'deep cool brown' — never just 'medium' or 'fair'",
  "fitzpatrickType": "I or II or III or IV or V or VI",
  "approximateHex": "the actual hex color of the skin you see, e.g. #D4956A",
  "oiliness": "dry or normal or oily or combination",
  "texture": "smooth or slightly uneven or uneven or rough",
  "concerns": ["list only what you can visually see, e.g. acne, dark spots, fine lines, redness — or none visible"],
  "undertone": "warm or cool or neutral"
}

Rules:
- tone: MUST be descriptive (2-3 words). NEVER output just "medium", "fair", "dark" alone.
- approximateHex: sample the actual forehead/cheek color. Do NOT use #C68642 as a default.
- concerns: only list what is VISIBLE in the photo. If skin looks clear, return ["none visible"].
- oiliness: look for shine on nose/forehead vs cheeks to determine this.

Return only the JSON object now.`;
}

function getSkinAnalysisFallbackPrompt(partialMLData) {
  return `Analyze this face photo and return ONLY a JSON object. No markdown, no explanation.

Partial on-device data (may be inaccurate, use as hints only):
${JSON.stringify(partialMLData, null, 2)}

Look at the ACTUAL image and return:
{
  "tone": "describe what you actually see, e.g. 'light warm beige' — never just 'medium'",
  "fitzpatrickType": "I or II or III or IV or V or VI",
  "approximateHex": "actual hex color sampled from skin, e.g. #D4956A",
  "oiliness": "dry or normal or oily or combination",
  "texture": "smooth or slightly uneven or uneven or rough",
  "concerns": ["only visually confirmed concerns, or none visible"],
  "undertone": "warm or cool or neutral"
}

Return only the JSON object now.`;
}

module.exports = { getSkinAnalysisPrompt, getSkinAnalysisFallbackPrompt };
