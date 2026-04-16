function validateSkinData(skinData) {
  if (!skinData) {
    return { valid: false, error: 'skinData is required' };
  }

  const requiredFields = ['tone', 'oiliness', 'texture', 'concerns', 'undertone'];
  
  for (const field of requiredFields) {
    if (!skinData[field]) {
      return { valid: false, error: `${field} is required in skinData` };
    }
  }

  if (!Array.isArray(skinData.concerns) || skinData.concerns.length === 0) {
    return { valid: false, error: 'concerns must be a non-empty array' };
  }

  return { valid: true };
}

function validateAnalysisInput(skinData, answers) {
  const skinValidation = validateSkinData(skinData);
  if (!skinValidation.valid) {
    return skinValidation;
  }

  if (!answers) {
    return { valid: false, error: 'answers is required' };
  }

  if (!Array.isArray(answers) || answers.length !== 8) {
    return { valid: false, error: 'answers must be an array of exactly 8 elements' };
  }

  return { valid: true };
}

module.exports = {
  validateSkinData,
  validateAnalysisInput
};
