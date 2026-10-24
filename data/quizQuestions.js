/**
 * Prakriti (dosha) quiz question bank.
 *
 * Every option carries a `score` that adds points to vata / pitta / kapha.
 * A clear single-dosha answer scores 2; a mixed answer splits 1 + 1.
 *
 * CORE questions are always asked. CONCERN questions are added only when the
 * image analysis detected that concern (see doshaService.detectSignals), so the
 * quiz feels personal without an LLM. ROUTINE_PREFERENCE does not score a dosha;
 * it controls how long the generated routine is.
 */

const CORE_SKIN_QUESTIONS = [
  {
    id: 'skin_feel',
    question: 'A few hours after washing your face (with no products on), how does your skin feel?',
    options: [
      { text: 'Tight, dry or slightly rough', score: { vata: 2 } },
      { text: 'Oily on the forehead and nose, normal or sensitive elsewhere', score: { pitta: 2 } },
      { text: 'Oily or shiny all over, but soft', score: { kapha: 2 } },
      { text: 'Comfortable, neither dry nor oily', score: { pitta: 1, kapha: 1 } },
    ],
  },
  {
    id: 'sun_reaction',
    question: 'How does your skin react to a day in the sun without sunscreen?',
    options: [
      { text: 'Burns or turns red easily, sometimes leaving freckles or dark spots', score: { pitta: 2 } },
      { text: 'Tans quickly and feels dry or dull afterwards', score: { vata: 2 } },
      { text: 'Tans slowly and evenly, rarely burns', score: { kapha: 2 } },
      { text: 'Breaks out or feels irritated', score: { pitta: 1, kapha: 1 } },
    ],
  },
  {
    id: 'weather',
    question: 'Which weather is hardest on your skin?',
    options: [
      { text: 'Cold, dry, windy winters: my skin flakes or cracks', score: { vata: 2 } },
      { text: 'Hot, sunny summers: I get red, sweaty or break out', score: { pitta: 2 } },
      { text: 'Humid monsoon: my skin gets oily and congested', score: { kapha: 2 } },
      { text: 'All seasons feel about the same', score: {} },
    ],
  },
];

const CORE_BODY_QUESTIONS = [
  {
    id: 'body_frame',
    question: 'Which best describes your natural body frame?',
    options: [
      { text: 'Slim and light; I find it hard to gain weight', score: { vata: 2 } },
      { text: 'Medium and athletic; my weight stays fairly stable', score: { pitta: 2 } },
      { text: 'Broad or solid; I gain weight easily and lose it slowly', score: { kapha: 2 } },
      { text: 'Medium, but I gain weight easily', score: { pitta: 1, kapha: 1 } },
    ],
  },
  {
    id: 'digestion',
    question: 'How would you describe your appetite and digestion?',
    options: [
      { text: 'Irregular: sometimes hungry, sometimes not, with bloating or gas', score: { vata: 2 } },
      { text: 'Strong: I get irritable or get acidity if I skip a meal', score: { pitta: 2 } },
      { text: 'Steady but slow: I can skip meals easily and feel heavy after eating', score: { kapha: 2 } },
      { text: 'Strong appetite, but I often feel bloated', score: { vata: 1, pitta: 1 } },
    ],
  },
  {
    id: 'sleep',
    question: 'How do you usually sleep?',
    options: [
      { text: 'Lightly: I wake up easily and my mind keeps racing', score: { vata: 2 } },
      { text: 'Moderately well, about 6-7 hours, and I often feel warm at night', score: { pitta: 2 } },
      { text: 'Deeply and long: I find it hard to wake up in the morning', score: { kapha: 2 } },
      { text: 'It changes a lot depending on stress', score: { vata: 1, pitta: 1 } },
    ],
  },
  {
    id: 'stress',
    question: 'When you are stressed, how do you usually react?',
    options: [
      { text: 'Anxious, worried or overwhelmed', score: { vata: 2 } },
      { text: 'Irritated, impatient or angry', score: { pitta: 2 } },
      { text: 'Withdrawn and low on energy; I tend to comfort-eat', score: { kapha: 2 } },
      { text: 'Irritable at first, then drained', score: { pitta: 1, kapha: 1 } },
    ],
  },
];

// Keyed by the concern signal that triggers them, in priority order.
const CONCERN_QUESTIONS = {
  acne: {
    id: 'acne_type',
    question: 'What are your breakouts usually like?',
    options: [
      { text: 'Red, painful or inflamed spots that can leave dark marks', score: { pitta: 2 } },
      { text: 'Blackheads, whiteheads and clogged pores', score: { kapha: 2 } },
      { text: 'Small, dry bumps that come and go with stress', score: { vata: 2 } },
      { text: 'Deeper bumps along the jaw or chin, often linked to hormones', score: { pitta: 1, kapha: 1 } },
    ],
  },
  redness: {
    id: 'product_reaction',
    question: 'How does your skin usually react to a new skincare product?',
    options: [
      { text: 'It stings, burns or turns red', score: { pitta: 2 } },
      { text: 'It feels dry, tight or flaky', score: { vata: 2 } },
      { text: 'It breaks out or feels clogged', score: { kapha: 2 } },
      { text: 'It rarely reacts', score: {} },
    ],
  },
  pigmentation: {
    id: 'healing',
    question: 'After a pimple, scratch or insect bite, how does your skin heal?',
    options: [
      { text: 'It leaves a dark mark that takes weeks or months to fade', score: { pitta: 2 } },
      { text: 'It heals slowly and the area stays dry or rough', score: { vata: 2 } },
      { text: 'It heals slowly but usually without a mark', score: { kapha: 2 } },
      { text: 'It heals quickly with no mark', score: {} },
    ],
  },
  dryness: {
    id: 'after_wash',
    question: 'How does your skin feel right after washing with plain water?',
    options: [
      { text: 'Tight and stretched: I need moisturiser immediately', score: { vata: 2 } },
      { text: 'Slightly tight, and it turns warm or red', score: { pitta: 2 } },
      { text: 'Comfortable, or still a little oily', score: { kapha: 2 } },
      { text: 'Itchy or rough in patches', score: { vata: 1, pitta: 1 } },
    ],
  },
  oiliness: {
    id: 'shine_timing',
    question: 'How quickly does your face get shiny after washing?',
    options: [
      { text: 'Within an hour, all over', score: { kapha: 2 } },
      { text: 'In a few hours, mostly on the forehead and nose', score: { pitta: 2 } },
      { text: 'Rarely: my skin is more dry than oily', score: { vata: 2 } },
      { text: 'Only in hot or humid weather', score: { pitta: 1, kapha: 1 } },
    ],
  },
  aging: {
    id: 'aging_signs',
    question: 'Where do you notice changes first as your skin ages?',
    options: [
      { text: 'Fine lines and dryness, especially around the eyes', score: { vata: 2 } },
      { text: 'Dark spots, uneven tone or redness', score: { pitta: 2 } },
      { text: 'Loss of firmness, puffiness or larger pores', score: { kapha: 2 } },
      { text: "I haven't noticed much change yet", score: {} },
    ],
  },
};

const ROUTINE_PREFERENCE = {
  id: 'routine_time',
  question: 'How much time do you want to spend on skincare each day?',
  options: [
    { text: '2-3 minutes: keep it simple', routineLength: 'minimal' },
    { text: '5-10 minutes: a proper routine', routineLength: 'standard' },
    { text: 'I enjoy a full self-care ritual', routineLength: 'full' },
    { text: 'Not sure, suggest what works best', routineLength: 'standard' },
  ],
};

const MAX_CONCERN_QUESTIONS = 2;

module.exports = {
  CORE_SKIN_QUESTIONS,
  CORE_BODY_QUESTIONS,
  CONCERN_QUESTIONS,
  ROUTINE_PREFERENCE,
  MAX_CONCERN_QUESTIONS,
};
