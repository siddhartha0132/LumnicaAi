module.exports = {
  skinDetection: {
    minPixelCount: 500,
    maxFileSizeBytes: 15 * 1024 * 1024,
  },

  fitzpatrick: {
    I: { LMin: 80, LMax: 100, description: 'very fair', hex: '#FDDBB4' },
    II: { LMin: 70, LMax: 80, description: 'fair', hex: '#F5CBA7' },
    III: { LMin: 55, LMax: 70, description: 'medium', hex: '#E8A87C' },
    IV: { LMin: 40, LMax: 55, description: 'olive/tan', hex: '#C68642' },
    V: { LMin: 25, LMax: 40, description: 'brown', hex: '#8D5524' },
    VI: { LMin: 0, LMax: 25, description: 'deep', hex: '#4A2912' },
  },

  undertone: {
    warm: { aMin: 5, aMax: 25, bMin: 15, bMax: 45 },
    cool: { aMin: -15, aMax: 0, bMin: -10, bMax: 15 },
    neutral: { aMin: -5, aMax: 5, bMin: 5, bMax: 20 },
    olive: { aMin: -5, aMax: 10, bMin: 20, bMax: 40 },
  },

  oiliness: {
    tZone: { high: 200, medium: 150, low: 100 },
    cheeks: { high: 180, medium: 130, low: 80 },
    specularThreshold: 35,
  },

  poreSize: {
    large: 35,
    medium: 22,
    small: 12,
  },

  texture: {
    smoothnessThreshold: 85,
    roughnessThreshold: 60,
  },

  labThresholds: {
    skinLMin: 20,
    skinLMax: 90,
    skinAMin: -5,
    skinAMax: 25,
    skinBMin: 5,
    skinBMax: 45,
  },

  confidence: {
    defaultScore: 0.85,
    minAcceptableScore: 0.60,
    lowLightPenalty: 0.15,
    darkSkinPenalty: 0.10,
  },

  faceRegion: {
    centerX: 0.5,
    centerY: 0.4,
    sampleRadius: 0.15,
  },
};