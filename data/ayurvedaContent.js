/**
 * Ayurvedic skincare content used by doshaService to build results.
 *
 * Recommendations are ingredient- and method-based on purpose: we do not
 * suggest branded products.
 *
 * Routine steps:
 *   order — position within the routine (cleanse 10, tone 20, treat 30,
 *           moisturise 40, protect 50, massage 60); add-ons slot in between.
 *   level — 'core' (always shown), 'standard' (hidden for the minimal
 *           routine), 'extra' (only for the full ritual).
 *
 * `avoidIf` lists detected concerns that make a step unsuitable (for example
 * steaming or scrubbing skin that shows redness).
 *
 * Concern add-ons may set `skipStepsFor`: dosha routines that already cover
 * that step, so it is not duplicated (tips are still shown).
 */

const DOSHAS = {
  vata: {
    name: 'Vata',
    elements: 'air and space',
    skin: 'Vata skin tends to be dry, thin and fine-pored, and often feels cool to the touch. When out of balance it becomes dehydrated, flaky or dull, and shows fine lines early, especially in cold, dry weather or during stressful periods.',
    influence: 'Vata adds a tendency towards dryness and sensitivity to cold, wind and stress.',
    focus: 'Your skin needs warmth, oil and deep hydration.',
  },
  pitta: {
    name: 'Pitta',
    elements: 'fire and water',
    skin: 'Pitta skin is warm, medium in thickness and often sensitive, usually with an oilier T-zone. When out of balance it reacts with redness, inflammation, breakouts, sunburn and pigmentation.',
    influence: 'Pitta adds warmth and sensitivity, so heat, sun and spicy food can trigger redness or breakouts.',
    focus: 'Your skin needs cooling, calming care and consistent sun protection.',
  },
  kapha: {
    name: 'Kapha',
    elements: 'earth and water',
    skin: 'Kapha skin is thick, soft, smooth and naturally well hydrated, and it tends to age slowly. When out of balance it becomes oily, with enlarged pores, blackheads, congestion and a dull look.',
    influence: 'Kapha adds oiliness and a tendency towards congestion and enlarged pores.',
    focus: 'Your skin needs light textures, regular deep cleansing and gentle stimulation.',
  },
};

const ROUTINES = {
  vata: {
    morning: [
      { order: 10, level: 'core', step: 'Cleanse', recommendation: 'A cream or milk-based cleanser, or a paste of fine oat flour and raw milk', reason: 'Cleans without stripping the natural oils Vata skin is short on.' },
      { order: 20, level: 'standard', step: 'Tone', recommendation: 'A mist of pure rose water', reason: 'Adds a layer of hydration and softens the skin.' },
      { order: 40, level: 'core', step: 'Moisturise', recommendation: 'A rich cream with shea butter, almond oil or glycerin, applied to slightly damp skin', reason: 'Locks water into the skin and strengthens a dry, thin barrier.' },
      { order: 50, level: 'core', step: 'Protect', recommendation: 'A broad-spectrum SPF 30+ sunscreen with a creamy texture', reason: 'Sun and wind dry Vata skin quickly and speed up fine lines.' },
    ],
    night: [
      { order: 10, level: 'core', step: 'Cleanse', recommendation: 'Oil cleanse: massage in a little almond or sesame oil, then wipe off with a warm, damp cloth', reason: 'Dissolves sunscreen and dirt while leaving the skin nourished.' },
      { order: 20, level: 'standard', step: 'Tone', recommendation: 'Rose water on a cotton pad', reason: 'Restores comfort after cleansing.' },
      { order: 40, level: 'core', step: 'Nourish', recommendation: '2-3 drops of almond, sesame or kumkumadi oil pressed into the skin (use a light gel moisturiser instead on breakout-prone areas)', reason: 'Night is when skin repairs; oil supports the barrier while you sleep.' },
      { order: 60, level: 'extra', step: 'Massage', recommendation: 'A slow 2-minute upward facial massage (mukha abhyanga) with the oil', reason: 'Boosts circulation and calms the nervous system, both key for Vata.' },
    ],
    weekly: [
      { order: 10, level: 'core', step: 'Hydrating mask', recommendation: 'Mashed ripe banana or avocado with a teaspoon of honey, 15 minutes', reason: 'Deeply nourishes and softens dry skin.' },
      { order: 20, level: 'standard', step: 'Gentle exfoliation', recommendation: 'Fine oat flour and milk paste, massaged very gently, once a week', reason: 'Lifts dry flakes without irritating thin skin.' },
      { order: 30, level: 'extra', step: 'Body oil ritual', recommendation: 'Warm sesame oil self-massage (abhyanga) 15 minutes before a bath', reason: 'The classic Ayurvedic practice for grounding Vata.' },
    ],
  },
  pitta: {
    morning: [
      { order: 10, level: 'core', step: 'Cleanse', recommendation: 'A gentle, fragrance-free cleanser, or chickpea flour (besan) mixed with rose water, in lukewarm water', reason: 'Cleans without heating or irritating sensitive skin.' },
      { order: 20, level: 'standard', step: 'Tone', recommendation: 'Rose water or chilled cucumber juice', reason: 'Cools the skin and calms redness.' },
      { order: 40, level: 'core', step: 'Moisturise', recommendation: 'A light gel moisturiser; pure aloe vera gel works well', reason: 'Hydrates while keeping the skin cool and light.' },
      { order: 50, level: 'core', step: 'Protect', recommendation: 'A broad-spectrum mineral SPF 30+ (zinc oxide), reapplied every 2-3 hours outdoors', reason: 'Pitta skin burns and develops pigmentation easily.' },
    ],
    night: [
      { order: 10, level: 'core', step: 'Cleanse', recommendation: 'The same gentle cleanser, with lukewarm (never hot) water', reason: 'Hot water adds heat and triggers redness in Pitta skin.' },
      { order: 20, level: 'standard', step: 'Tone', recommendation: 'Rose water on a cotton pad', reason: 'Soothes the skin after the day.' },
      { order: 40, level: 'core', step: 'Calm', recommendation: 'A thin layer of aloe vera gel, or a few drops of kumkumadi oil if you are not breaking out', reason: 'Calms inflammation and helps even out skin tone overnight.' },
      { order: 60, level: 'extra', step: 'Cool down', recommendation: 'Press chilled rose-water pads on the face for 2 minutes', reason: 'Reduces heat and puffiness before sleep.' },
    ],
    weekly: [
      { order: 10, level: 'core', step: 'Cooling mask', recommendation: 'Sandalwood (chandan) powder mixed with rose water, 10-15 minutes', reason: 'Traditionally used to cool and calm Pitta skin.' },
      { order: 20, level: 'standard', step: 'Gentle exfoliation', recommendation: 'Fine oat powder with plain yogurt, once a week; avoid grainy scrubs', reason: 'Yogurt\'s lactic acid smooths the skin without the friction that causes redness.' },
      { order: 30, level: 'extra', step: 'Scalp ritual', recommendation: 'A coconut oil head massage before bed', reason: 'Coconut oil is cooling and helps settle Pitta.' },
    ],
  },
  kapha: {
    morning: [
      { order: 10, level: 'core', step: 'Cleanse', recommendation: 'A foaming or gel cleanser, or chickpea flour (besan) with a pinch of turmeric', reason: 'Removes excess oil and wakes up the skin.' },
      { order: 20, level: 'standard', step: 'Tone', recommendation: 'A neem or green tea toner', reason: 'Balances oil and refines the look of pores.' },
      { order: 40, level: 'core', step: 'Moisturise', recommendation: 'An oil-free gel moisturiser', reason: 'Even oily skin needs water; skipping it can make skin produce more oil.' },
      { order: 50, level: 'core', step: 'Protect', recommendation: 'An oil-free or matte-finish SPF 30+ sunscreen', reason: 'Protects without clogging pores.' },
    ],
    night: [
      { order: 10, level: 'core', step: 'Double cleanse', recommendation: 'A light oil (such as jojoba) or micellar water first, then your foaming cleanser', reason: 'Clears sunscreen and oil from deep in the pores.' },
      { order: 20, level: 'standard', step: 'Tone', recommendation: 'A neem or green tea toner', reason: 'Keeps pores clear overnight.' },
      { order: 40, level: 'core', step: 'Moisturise', recommendation: 'A light gel moisturiser; add a drop of jojoba oil only if your skin feels tight', reason: 'Keeps skin balanced without heaviness.' },
      { order: 60, level: 'extra', avoidIf: ['redness'], step: 'Stimulate', recommendation: 'A brisk 1-minute upward massage with fingertips or a chilled face roller', reason: 'Stimulating touch reduces puffiness and brings a glow to Kapha skin.' },
    ],
    weekly: [
      { order: 10, level: 'core', step: 'Clay mask', recommendation: 'Multani mitti (fuller\'s earth) with rose water, 10 minutes, twice a week', reason: 'Absorbs excess oil and clears congested pores.' },
      { order: 20, level: 'standard', avoidIf: ['redness'], step: 'Ubtan exfoliation', recommendation: 'Chickpea flour, turmeric and a little yogurt, gently scrubbed, twice a week', reason: 'Brightens dull skin and removes build-up.' },
      { order: 30, level: 'extra', avoidIf: ['redness'], step: 'Face steam', recommendation: '5 minutes of plain steam with a towel over your head, followed by the clay mask', reason: 'Softens congestion so the mask works deeper.' },
    ],
  },
};

// Added on top of the dosha routine when the image analysis detects a concern.
// Listed in priority order: the minimal routine keeps only the first match.
const CONCERN_ADDONS = {
  acne: {
    label: 'breakouts',
    steps: {
      night: [{ order: 30, level: 'core', step: 'Spot treatment', recommendation: 'Dab neem powder paste (neem + water) or diluted tea tree oil on active pimples only', reason: 'Antibacterial care that targets breakouts without drying out the whole face.' }],
    },
    tips: [
      'Avoid picking or squeezing pimples: it spreads bacteria and leaves dark marks.',
      'Change your pillowcase twice a week and keep your phone screen clean.',
      'If breakouts are painful, deep or leave scars, see a dermatologist: this may need medical treatment.',
    ],
  },
  redness: {
    skipStepsFor: ['pitta'],
    label: 'redness and sensitivity',
    steps: {
      night: [{ order: 30, level: 'core', step: 'Soothe', recommendation: 'A thin layer of fresh aloe vera gel on red areas', reason: 'Cools and calms irritated skin.' }],
    },
    tips: [
      'Patch-test every new product on your jawline for 24 hours before using it on your face.',
      'Avoid hot water, grainy scrubs and fragranced products.',
    ],
  },
  pigmentation: {
    label: 'dark spots and uneven tone',
    steps: {
      morning: [{ order: 30, level: 'core', step: 'Brighten', recommendation: 'A vitamin C or licorice (yashtimadhu) extract serum before sunscreen', reason: 'Helps fade dark spots and adds antioxidant protection.' }],
    },
    tips: [
      'Sunscreen is the most important step for dark spots: reapply every 2-3 hours when outdoors.',
      'Results take 8-12 weeks, so stay consistent.',
    ],
  },
  dryness: {
    label: 'dryness',
    steps: {
      morning: [{ order: 30, level: 'core', step: 'Hydrate', recommendation: 'A glycerin or hyaluronic acid serum on damp skin, before moisturiser', reason: 'Draws water into the skin before you seal it in.' }],
    },
    tips: [
      'Wash with lukewarm water and pat, don\'t rub, your face dry.',
      'Keep a humidifier or a bowl of water in air-conditioned rooms.',
    ],
  },
  oiliness: {
    skipStepsFor: ['kapha'],
    label: 'oiliness and enlarged pores',
    steps: {
      weekly: [{ order: 15, level: 'standard', step: 'Pore care', recommendation: 'An extra multani mitti mask on the T-zone only', reason: 'Controls shine where oil builds up most.' }],
    },
    tips: [
      'Use plain blotting paper during the day instead of washing your face repeatedly.',
      'Over-washing strips the skin and can make it produce even more oil.',
    ],
  },
  aging: {
    label: 'fine lines and firmness',
    steps: {
      night: [{ order: 35, level: 'standard', step: 'Renew', recommendation: 'Bakuchiol serum (a plant-based retinol alternative), 2-3 nights a week', reason: 'Supports smoother, firmer skin with less irritation than retinol.' }],
    },
    tips: [
      'Sleep on your back where you can, and apply eye care with your ring finger.',
    ],
  },
  dullness: {
    skipStepsFor: ['kapha'],
    label: 'dullness',
    steps: {
      weekly: [{ order: 25, level: 'standard', avoidIf: ['redness'], step: 'Glow ubtan', recommendation: 'Chickpea flour, a pinch of turmeric and milk, left on for 10 minutes', reason: 'A traditional mix that gently exfoliates and brightens.' }],
    },
    tips: [
      'Drink enough water and add a daily 20-minute walk: circulation shows on your face.',
    ],
  },
  darkCircles: {
    label: 'dark circles and puffiness',
    steps: {},
    tips: [
      'Place chilled rose-water pads over your eyes for 5 minutes in the morning.',
      'Aim for 7-8 hours of sleep at a regular time.',
    ],
  },
};

const LIFESTYLE = {
  vata: {
    eat: ['Warm, cooked, slightly oily meals: soups, dals, stews and ghee', 'Sweet fruits such as bananas, mangoes and soaked dates', 'Warm water and herbal teas (ginger, tulsi) through the day'],
    avoid: ['Raw salads and cold drinks in excess', 'Dry, crunchy snacks', 'Too much coffee'],
    habits: ['Keep regular meal and sleep times (ideally 10 pm to 6 am)', 'Warm sesame oil self-massage before your bath', 'Protect your skin from cold wind'],
  },
  pitta: {
    eat: ['Cooling foods: cucumber, melons, leafy greens and coconut water', 'Sweet, bitter and astringent tastes', 'Ghee in moderation'],
    avoid: ['Very spicy, fried or fermented foods', 'Alcohol and excess coffee', 'Skipping meals'],
    habits: ['Avoid strong midday sun', 'Choose calming exercise: evening walks, swimming, yoga', 'Take short breaks to manage stress and irritability'],
  },
  kapha: {
    eat: ['Light, warm meals: lentils, steamed vegetables and millets', 'Warming spices: ginger, black pepper and turmeric', 'Bitter and astringent tastes'],
    avoid: ['Heavy, sweet and fried foods', 'Too much dairy', 'Cold drinks'],
    habits: ['Wake up early, before 6 am', 'Get vigorous exercise every day', 'Avoid daytime naps'],
  },
};

const DISCLAIMER = 'This profile is Ayurvedic wellness guidance, not a medical diagnosis. Patch-test new ingredients, and see a dermatologist for persistent, painful or worsening skin problems.';

module.exports = { DOSHAS, ROUTINES, CONCERN_ADDONS, LIFESTYLE, DISCLAIMER };
