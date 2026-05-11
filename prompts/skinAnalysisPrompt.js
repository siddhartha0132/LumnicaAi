/**
 * ANTI_GRAVITY_PROMPT — Forces Gemini Vision to analyze each image uniquely.
 * No caching, no templates, no hardcoded defaults.
 */
function getSkinAnalysisPrompt() {
  return `CRITICAL: You are analyzing a REAL uploaded image right now. NEVER use cached, template, or previously generated responses.

STEP 1 - FIRST verify you can see the image: Say "IMAGE_LOADED" if you can see it
STEP 2 - Then analyze ONLY what you SEE in THIS SPECIFIC image:

FOR SKIN TONE (STRICT RULES):
- NO generic terms like "medium warm" or "combination" alone
- MUST include specific color + percentage estimate based on image
- Examples of CORRECT outputs:
  * "fair porcelain (90% even, 10% redness on cheeks)"
  * "light olive with golden undertones (80% even, 20% sun exposure)"
  * "deep ebony with cool undertones (95% uniform)"
  * "tan with warm golden hue (uneven due to sun spots)"

FOR OILINESS:
- Specify T-Zone vs Cheeks separately based on visible shine
- Use numbers: "T-zone: 7/10 oily, Cheeks: 2/10 dry"

FOR TEXTURE:
- Describe ACTUAL visible features from THIS image
- Mention pores size, smoothness, bumps, or lines you SEE

FOR CONCERNS:
- List ONLY issues VISIBLE in THIS exact image
- If acne: say scattered/pustules/cystic and location
- If scars: describe shape/color/size you observe

FOR UNDERTONE:
- Determine from wrist veins OR how skin reacts to light IN THIS PHOTO
- Say "unable to determine from image lighting" if not clear

CRITICAL RULE: If you have to say the EXACT same thing for two different images, you are WRONG. Every image produces UNIQUE output based on its pixels.

RETURN ONLY VALID JSON with exact structure:
{
  "skinData": {
    "tone": "specific description with percentages",
    "oiliness": "T-zone: X/10, Cheeks: Y/10",
    "texture": "specific visible features from this image",
    "concerns": ["visible issue 1", "visible issue 2"],
    "undertone": "cool/warm/neutral or unable to determine"
  },
  "imageConfidence": "high/medium/low - based on image quality"
}

REMEMBER: You are AI vision - you SEE images. Each upload is UNIQUE. No hardcoding. No templates. No repetition.`;
}

function getSkinAnalysisFallbackPrompt(partialMLData) {
  return `CRITICAL: You are analyzing a REAL uploaded image right now. NEVER use cached, template, or previously generated responses.

Partial on-device data (use as hints only, verify against the actual image):
${JSON.stringify(partialMLData, null, 2)}

STEP 1 - Confirm: Say "IMAGE_LOADED" first.
STEP 2 - Analyze ONLY what you SEE in THIS SPECIFIC image:

FOR SKIN TONE (STRICT RULES):
- NO generic terms like "medium warm" alone
- MUST include specific color + percentage estimate based on image
- Example: "light beige with pink undertones (85% even, 15% uneven around nose)"

FOR OILINESS:
- Specify T-Zone vs Cheeks separately: "T-zone: X/10 oily, Cheeks: Y/10 dry"

FOR TEXTURE:
- Describe ACTUAL pore size, smoothness, bumps, or lines visible in THIS image

FOR CONCERNS:
- Only list issues VISIBLE in THIS exact image
- Be specific: type, location, severity

FOR UNDERTONE:
- cool/warm/neutral based on THIS photo's lighting and skin

CRITICAL RULE: Output must differ from any previous image. Every image is unique.

RETURN ONLY VALID JSON:
{
  "skinData": {
    "tone": "specific description with percentages",
    "oiliness": "T-zone: X/10, Cheeks: Y/10",
    "texture": "specific visible features from this image",
    "concerns": ["visible issue 1", "visible issue 2"],
    "undertone": "cool/warm/neutral or unable to determine"
  },
  "imageConfidence": "high/medium/low - based on image quality"
}`;
}

module.exports = { getSkinAnalysisPrompt, getSkinAnalysisFallbackPrompt };
