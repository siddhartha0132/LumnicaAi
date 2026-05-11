const logger = require('../utils/logger');

const PRODUCT_DATABASE = [
  // VATA PRODUCTS (nourishing, grounding, warm)
  { name: 'Sesame Oil Face Massage', price: 399, dosha: ['Vata', 'Vata-Pitta', 'Vata-Kapha'], benefit: 'Deep nourishment for dry, thin skin' },
  { name: 'Abhyanga Herbal Oil', price: 499, dosha: ['Vata', 'Vata-Pitta'], benefit: 'Grounding and balancing for sensitive skin' },
  { name: 'Ghee-Based Face Butter', price: 349, dosha: ['Vata', 'Vata-Kapha'], benefit: 'Rich moisture barrier for mature skin' },
  { name: 'Brahmi Oil Scalp & Facial', price: 329, dosha: ['Vata', 'Vata-Pitta', 'Vata-Kapha'], benefit: 'Calming and rejuvenating' },

  // PITTA PRODUCTS (cooling, soothing, anti-inflammatory)
  { name: 'Rose Water & Neem Toner', price: 199, dosha: ['Pitta', 'Pitta-Vata', 'Pitta-Kapha'], benefit: 'Cooling and clarifying for sensitive skin' },
  { name: 'Kumkumadi Tailam Face Oil', price: 699, dosha: ['Pitta', 'Pitta-Vata', 'Pitta-Kapha'], benefit: 'Reduces dark spots and brightens complexion' },
  { name: 'Neem & Tulsi Face Wash', price: 249, dosha: ['Pitta', 'Pitta-Kapha'], benefit: 'Purifies and controls inflammation' },
  { name: 'Chandan (Sandalwood) Face Mask', price: 279, dosha: ['Pitta', 'Pitta-Vata', 'Pitta-Kapha'], benefit: 'Cools and soothes irritated skin' },
  { name: 'Aloe Vera Cooling Gel', price: 199, dosha: ['Pitta', 'Pitta-Vata'], benefit: 'Instant cooling and hydration' },
  { name: 'Manjistha Face Serum', price: 449, dosha: ['Pitta', 'Pitta-Kapha'], benefit: 'Blood purifying, reduces redness' },

  // KAPHA PRODUCTS (stimulating, light, warming)
  { name: 'Ginger & Turmeric Face Scrub', price: 299, dosha: ['Kapha', 'Kapha-Vata', 'Kapha-Pitta'], benefit: 'Stimulates circulation, brightens dull skin' },
  { name: 'Honey & Lemon Clarifying Mask', price: 249, dosha: ['Kapha', 'Kapha-Pitta'], benefit: 'Deep cleansing and pore minimizing' },
  { name: 'Triphala Vitamin C Serum', price: 549, dosha: ['Kapha', 'Kapha-Pitta'], benefit: 'Brightening and antioxidant protection' },
  { name: 'Triphaladi Oil Cleanser', price: 379, dosha: ['Kapha', 'Kapha-Vata'], benefit: 'Detoxifying and balancing' },
  { name: 'Neem & Turmeric Face Pack', price: 149, dosha: ['Kapha', 'Kapha-Pitta'], benefit: 'Antibacterial and stimulating' },

  // UNIVERSAL/BALANCED PRODUCTS
  { name: 'Rose Water Hydrosol', price: 179, dosha: ['Vata', 'Pitta', 'Kapha'], benefit: 'Universal hydration and toning' },
  { name: 'Coconut Oil (cold-pressed)', price: 299, dosha: ['Pitta', 'Kapha', 'Pitta-Kapha'], benefit: 'Light moisturizer for balanced skin' },
  { name: 'Brahmi & Bhringraj Herbal Pack', price: 229, dosha: ['Vata', 'Pitta', 'Kapha'], benefit: 'Cooling and nourishing tonic' },
];

const productService = {
  /**
   * Select curated products for skin analysis based on dosha and skin type
   * @param {string} doshaType - User's dosha type (e.g., "Pitta-Kapha")
   * @param {object} skinData - Skin profile data
   * @param {number} limit - Maximum number of products to return
   * @returns {array} Recommended products
   */
  selectProductsForAnalysis(doshaType, skinData, limit = 5) {
    logger.debug('Selecting products', { doshaType, limit });

    if (!doshaType) {
      logger.warn('No dosha type provided, returning generic products');
      return this.getGenericProducts(limit);
    }

    // Find products that match the dosha
    const matchedProducts = PRODUCT_DATABASE.filter(product =>
      product.dosha.includes(doshaType) ||
      product.dosha.some(d => doshaType.includes(d))
    );

    logger.debug('Matched products', { count: matchedProducts.length, doshaType });

    // If we have matches, sort by relevance and return limited set
    if (matchedProducts.length > 0) {
      return matchedProducts.slice(0, limit).map(p => ({
        name: p.name,
        price: p.price,
        benefit: p.benefit,
        dosha: p.dosha.join(','),
      }));
    }

    // Fallback to generic products if no dosha match
    return this.getGenericProducts(limit);
  },

  /**
   * Get generic products when dosha matching fails
   */
  getGenericProducts(limit = 5) {
    const generic = PRODUCT_DATABASE.filter(p =>
      p.dosha.includes('Pitta') && p.dosha.includes('Kapha')
    );
    return generic.slice(0, limit).map(p => ({
      name: p.name,
      price: p.price,
      benefit: p.benefit,
      dosha: p.dosha.join(','),
    }));
  },

  /**
   * Get all products for a specific dosha
   */
  getProductsByDosha(doshaType) {
    return PRODUCT_DATABASE.filter(product =>
      product.dosha.includes(doshaType)
    );
  },

  /**
   * Search products by name or benefit
   */
  searchProducts(query) {
    const lowerQuery = query.toLowerCase();
    return PRODUCT_DATABASE.filter(product =>
      product.name.toLowerCase().includes(lowerQuery) ||
      product.benefit.toLowerCase().includes(lowerQuery)
    );
  },
};

module.exports = productService;
const productsData = require('../data/products.json');
const logger = require('../utils/logger');

const DEFAULT_PRICE_RANGE = { min: 99, max: 1999 };
const MAX_PRODUCTS_RECOMMENDATION = 7;
const MIN_PRODUCTS_RECOMMENDATION = 5;

const productService = {
  getAllProducts() {
    return productsData.products;
  },

  getProductById(id) {
    return productsData.products.find(p => p.id === id) || null;
  },

  filterProducts({ dosha = [], skinTypes = [], concerns = [], priceRange = DEFAULT_PRICE_RANGE, limit = 10 }) {
    return productsData.products
      .filter(p => {
        if (!p.inStock) return false;
        if (p.price < priceRange.min || p.price > priceRange.max) return false;
        if (dosha.length > 0 && !dosha.some(d => p.dosha.includes(d))) return false;
        if (skinTypes.length > 0 && !skinTypes.some(s => p.skinTypes.includes('all skin types') || p.skinTypes.includes(s))) return false;
        return true;
      })
      .slice(0, limit);
  },

  selectProductsForAnalysis(doshaType, skinData, numProducts = 7) {
    const doshaList = parseDoshaType(doshaType);
    const skinTypes = skinData.oiliness ? [skinData.oiliness] : [];
    const selectedProducts = [];
    const usedCategories = new Set();
    const shuffled = [...productsData.products].sort(() => Math.random() - 0.5);

    for (const product of shuffled) {
      if (selectedProducts.length >= numProducts) break;
      if (!product.inStock) continue;

      const doshaMatch = product.dosha.some(d => doshaList.includes(d)) || product.dosha.includes('Vata') && product.dosha.includes('Pitta') && product.dosha.includes('Kapha');
      if (!doshaMatch) continue;

      const skinTypeMatch = skinTypes.length === 0 || skinTypes.some(s => product.skinTypes.includes(s) || product.skinTypes.includes('all skin types'));
      if (!skinTypeMatch) continue;

      if (usedCategories.has(product.category) && usedCategories.size < 6) continue;

      usedCategories.add(product.category);
      selectedProducts.push({
        id: product.id,
        name: product.name,
        price: product.price,
        benefit: product.benefits[0] || product.benefits.join(', '),
        dosha: product.dosha.join(','),
        category: product.category,
        ingredients: product.ingredients.slice(0, 4),
        instructions: product.instructions,
      });
    }

    while (selectedProducts.length < MIN_PRODUCTS_RECOMMENDATION && selectedProducts.length < productsData.products.length) {
      const remaining = productsData.products.filter(p =>
        !selectedProducts.find(s => s.id === p.id) && p.inStock
      );
      if (remaining.length === 0) break;
      const fallback = remaining[Math.floor(Math.random() * remaining.length)];
      selectedProducts.push({
        id: fallback.id,
        name: fallback.name,
        price: fallback.price,
        benefit: fallback.benefits[0],
        dosha: fallback.dosha.join(','),
        category: fallback.category,
        instructions: fallback.instructions,
      });
    }

    return selectedProducts.slice(0, MAX_PRODUCTS_RECOMMENDATION);
  },
};

function parseDoshaType(doshaType) {
  if (!doshaType) return [];
  const normalized = doshaType.toLowerCase().replace(/\s+/g, '').split(/[-,]/);
  return normalized.map(d => {
    const trimmed = d.trim();
    if (['vata', 'pitta', 'kapha'].includes(trimmed)) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
    return null;
  }).filter(Boolean);
}

module.exports = productService;