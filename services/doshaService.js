const {
  CORE_SKIN_QUESTIONS,
  CORE_BODY_QUESTIONS,
  CONCERN_QUESTIONS,
  ROUTINE_PREFERENCE,
  MAX_CONCERN_QUESTIONS,
} = require('../data/quizQuestions');
const { DOSHAS, ROUTINES, CONCERN_ADDONS, LIFESTYLE, DISCLAIMER } = require('../data/ayurvedaContent');
const { AppError } = require('../middleware/errorHandler');

const DOSHA_KEYS = ['vata', 'pitta', 'kapha'];

// Priority order: used to pick concern questions and the minimal routine's add-on.
const CONCERN_PATTERNS = [
  ['acne', /acne|pimple|breakout|blemish|whitehead|pustule|papule|cyst/i],
  ['redness', /\bred(ness)?\b|rosacea|irritat|inflam|sensitiv|rash/i],
  ['pigmentation', /pigment|dark spot|melasma|uneven (skin )?tone|discolou?r|acne mark|freckle|sun damage|\bspots?\b/i],
  ['dryness', /\bdry|dryness|flak|dehydrat|rough|scaly|tight/i],
  ['oiliness', /oily|oiliness|shine|shiny|greasy|sebum|(enlarged|large|open|clogged) pores?|blackhead|congest|comedon/i],
  ['aging', /fine line|wrinkle|sagging|crow'?s feet|ag(e)?ing|laxity/i],
  ['dullness', /dull|lacklust/i],
  ['darkCircles', /dark circle|under-?eye|puff/i],
];

const ALL_QUESTIONS = [
  ...CORE_SKIN_QUESTIONS,
  ...CORE_BODY_QUESTIONS,
  ...Object.values(CONCERN_QUESTIONS),
  ROUTINE_PREFERENCE,
];
const QUESTIONS_BY_ID = new Map(ALL_QUESTIONS.map(q => [q.id, q]));

const MIN_SCORED_ANSWERS = 3;
const MAX_ADDON_CONCERNS = 3;
const MAX_TIPS = 6;

const doshaService = {
  /**
   * Parse "T-zone: 7/10, Cheeks: 3/10" (or plain words like "oily") into numbers.
   * Returns null when nothing usable is found.
   */
  parseOiliness(oiliness) {
    if (typeof oiliness !== 'string') return null;

    const tZone = oiliness.match(/t-?zone[^0-9]*(\d+(?:\.\d+)?)/i);
    const cheeks = oiliness.match(/cheeks?[^0-9]*(\d+(?:\.\d+)?)/i);
    if (tZone && cheeks) {
      const t = Math.min(10, parseFloat(tZone[1]));
      const c = Math.min(10, parseFloat(cheeks[1]));
      return { tZone: t, cheeks: c, average: (t + c) / 2 };
    }

    if (/combination/i.test(oiliness)) return { tZone: 7, cheeks: 3, average: 5 };
    if (/oily/i.test(oiliness)) return { tZone: 8, cheeks: 7, average: 7.5 };
    if (/dry/i.test(oiliness)) return { tZone: 3, cheeks: 2, average: 2.5 };
    if (/normal/i.test(oiliness)) return { tZone: 5, cheeks: 4, average: 4.5 };
    return null;
  },

  skinTypeLabel(oil) {
    if (!oil) return null;
    if (oil.average >= 7) return 'oily';
    if (oil.tZone >= 6 && oil.cheeks <= 4) return 'combination';
    if (oil.average <= 3) return 'dry';
    return 'normal';
  },

  /**
   * Turn the image analysis into signals: parsed oiliness + detected concerns
   * (as keys of CONCERN_ADDONS, in priority order).
   */
  detectSignals(skinData = {}) {
    const oil = this.parseOiliness(skinData.oiliness);
    const concernText = [
      ...(Array.isArray(skinData.concerns) ? skinData.concerns : []),
      skinData.texture,
    ]
      .filter(c => typeof c === 'string' && !/none visible/i.test(c))
      .join(' | ');

    const found = new Set(
      CONCERN_PATTERNS.filter(([, pattern]) => pattern.test(concernText)).map(([key]) => key)
    );
    const type = this.skinTypeLabel(oil);
    if (type === 'oily') found.add('oiliness');
    if (type === 'dry') found.add('dryness');

    const concerns = CONCERN_PATTERNS.map(([key]) => key).filter(key => found.has(key));
    return { oil, type, concerns };
  },

  /** The questions asked for this person, in display order (full objects). */
  selectQuestions(skinData) {
    const { concerns } = this.detectSignals(skinData);
    const concernQuestions = concerns
      .filter(key => CONCERN_QUESTIONS[key])
      .slice(0, MAX_CONCERN_QUESTIONS)
      .map(key => CONCERN_QUESTIONS[key]);

    return [...CORE_SKIN_QUESTIONS, ...concernQuestions, ...CORE_BODY_QUESTIONS, ROUTINE_PREFERENCE];
  },

  /** Public quiz payload: option scores stay on the server. */
  getQuiz(skinData) {
    return this.selectQuestions(skinData).map(q => ({
      id: q.id,
      question: q.question,
      options: q.options.map(o => o.text),
    }));
  },

  /** Points from the photo itself; kept small so the quiz answers dominate. */
  scoreSkin({ oil, type, concerns }) {
    const scores = { vata: 0, pitta: 0, kapha: 0 };
    if (type === 'oily') scores.kapha += 2;
    if (type === 'combination') scores.pitta += 1;
    if (type === 'dry') scores.vata += 2;

    const has = key => concerns.includes(key);
    if (has('acne')) { scores.pitta += 1; scores.kapha += 1; }
    if (has('redness')) scores.pitta += 2;
    if (has('pigmentation')) scores.pitta += 1;
    if (has('dryness') && type !== 'dry') scores.vata += 1;
    if (has('oiliness') && type !== 'oily') scores.kapha += 1;
    if (has('aging')) scores.vata += 1;
    if (has('darkCircles')) scores.vata += 1;
    return { scores, oil };
  },

  scoreAnswers(questions, answers) {
    const scores = { vata: 0, pitta: 0, kapha: 0 };
    let scoredAnswers = 0;
    let routineLength = 'standard';

    questions.forEach((question, i) => {
      if (!question || answers[i] == null) return;
      const option = question.options.find(o => o.text === String(answers[i]).trim());
      if (!option) return;

      if (option.routineLength) {
        routineLength = option.routineLength;
        return;
      }
      DOSHA_KEYS.forEach(d => { scores[d] += option.score[d] || 0; });
      scoredAnswers++;
    });

    return { scores, scoredAnswers, routineLength };
  },

  /** Percentages that add up to exactly 100. */
  toPercentages(scores) {
    const total = DOSHA_KEYS.reduce((sum, d) => sum + scores[d], 0);
    const pct = {};
    DOSHA_KEYS.forEach(d => { pct[d] = Math.round((scores[d] / total) * 100); });
    const drift = 100 - DOSHA_KEYS.reduce((sum, d) => sum + pct[d], 0);
    const largest = DOSHA_KEYS.reduce((a, b) => (pct[a] >= pct[b] ? a : b));
    pct[largest] += drift;
    return pct;
  },

  /**
   * Single dosha when one clearly leads, dual when the top two are close,
   * tridoshic when all three are nearly equal.
   */
  classify(scores) {
    const pct = this.toPercentages(scores);
    const [first, second, third] = [...DOSHA_KEYS].sort((a, b) => pct[b] - pct[a]);

    if (pct[first] - pct[third] <= 10) {
      return { type: 'Tridoshic (Vata-Pitta-Kapha)', primary: first, secondary: null, tridoshic: true, percentages: pct };
    }
    if (pct[first] - pct[second] <= 12) {
      return { type: `${DOSHAS[first].name}-${DOSHAS[second].name}`, primary: first, secondary: second, tridoshic: false, percentages: pct };
    }
    return { type: DOSHAS[first].name, primary: first, secondary: null, tridoshic: false, percentages: pct };
  },

  describe({ primary, secondary, tridoshic }) {
    const p = DOSHAS[primary];
    if (tridoshic) {
      return `Your constitution is balanced across all three doshas (tridoshic), with ${p.name} slightly ahead. Balanced skin is usually resilient, but it shifts with the seasons: it can turn dry in winter, sensitive in summer and oily in the monsoon. ${p.focus}`;
    }
    if (secondary) {
      const s = DOSHAS[secondary];
      return `Your constitution is ${p.name}-${s.name}: mainly ${p.name} (${p.elements}) with a strong ${s.name} influence. ${p.skin} ${s.influence} ${p.focus}`;
    }
    return `Your dominant dosha is ${p.name} (${p.elements}). ${p.skin} ${p.focus}`;
  },

  buildRoutine({ primary, secondary }, concerns, routineLength) {
    const allowed = {
      minimal: ['core'],
      standard: ['core', 'standard'],
      full: ['core', 'standard', 'extra'],
    }[routineLength] || ['core', 'standard'];

    const routine = {
      morning: [...ROUTINES[primary].morning],
      night: [...ROUTINES[primary].night],
      weekly: [...ROUTINES[primary].weekly],
    };

    // Dual dosha: add the secondary dosha's signature weekly treatment.
    if (secondary) {
      const [signature] = ROUTINES[secondary].weekly;
      routine.weekly.push({ ...signature, order: 12, level: 'standard' });
    }

    const addonConcerns = concerns.slice(0, routineLength === 'minimal' ? 1 : MAX_ADDON_CONCERNS);
    addonConcerns.forEach(key => {
      const addon = CONCERN_ADDONS[key];
      if (addon.skipStepsFor?.includes(primary)) return;
      Object.entries(addon.steps).forEach(([slot, steps]) => routine[slot].push(...steps));
    });

    const finalise = steps => {
      const seen = new Set();
      return steps
        .filter(s => allowed.includes(s.level))
        .filter(s => !s.avoidIf?.some(concern => concerns.includes(concern)))
        .sort((a, b) => a.order - b.order)
        .filter(s => !seen.has(s.step) && seen.add(s.step))
        .map(({ step, recommendation, reason }) => ({ step, recommendation, reason }));
    };

    return {
      morning: finalise(routine.morning),
      night: finalise(routine.night),
      weekly: finalise(routine.weekly),
    };
  },

  buildTips(concerns) {
    return concerns
      .slice(0, MAX_ADDON_CONCERNS)
      .flatMap(key => CONCERN_ADDONS[key].tips)
      .slice(0, MAX_TIPS);
  },

  /**
   * Full result: dosha, routine, tips and lifestyle guidance.
   * `questionIds` (sent back by the client) says which question each answer
   * belongs to; without it we rebuild the same question list from skinData.
   */
  analyze({ skinData, answers, questionIds }) {
    const questions = Array.isArray(questionIds)
      ? questionIds.map(id => QUESTIONS_BY_ID.get(id))
      : this.selectQuestions(skinData);

    const quiz = this.scoreAnswers(questions, answers);
    if (quiz.scoredAnswers < MIN_SCORED_ANSWERS) {
      throw new AppError(`At least ${MIN_SCORED_ANSWERS} answers must match the quiz questions`, 400);
    }

    const signals = this.detectSignals(skinData);
    const skin = this.scoreSkin(signals);
    const scores = {};
    DOSHA_KEYS.forEach(d => { scores[d] = quiz.scores[d] + skin.scores[d]; });

    const dosha = this.classify(scores);
    const lifestyle = LIFESTYLE[dosha.primary];
    const lowerFirst = s => s.charAt(0).toLowerCase() + s.slice(1);

    return {
      dosha: {
        type: dosha.type,
        primary: DOSHAS[dosha.primary].name,
        secondary: dosha.secondary ? DOSHAS[dosha.secondary].name : null,
        description: this.describe(dosha),
        scores: dosha.percentages,
      },
      skinProfile: {
        tone: skinData.tone,
        type: signals.type || skinData.oiliness,
        concerns: signals.concerns.map(key => CONCERN_ADDONS[key].label),
        undertone: skinData.undertone,
      },
      routine: this.buildRoutine(dosha, signals.concerns, quiz.routineLength),
      tips: this.buildTips(signals.concerns),
      lifestyle,
      doshaInsights: `To keep ${DOSHAS[dosha.primary].name} in balance: ${lifestyle.habits.map(lowerFirst).join('; ')}.`,
      products: [],
      disclaimer: DISCLAIMER,
    };
  },
};

module.exports = doshaService;
