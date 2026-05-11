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
   */
  selectProductsForAnalysis(doshaType, skinData, limit = 5) {
    logger.debug('Selecting products', { doshaType, limit });

    if (!doshaType) {
      logger.warn('No dosha type provided, returning generic products');
      return this.getGenericProducts(limit);
    }

    const matchedProducts = PRODUCT_DATABASE.filter(product =>
      product.dosha.includes(doshaType) ||
      product.dosha.some(d => doshaType.includes(d))
    );

    logger.debug('Matched products', { count: matchedProducts.length, doshaType });

    if (matchedProducts.length > 0) {
      return matchedProducts.slice(0, limit).map(p => ({
        name: p.name,
        price: p.price,
        benefit: p.benefit,
        dosha: p.dosha.join(','),
      }));
    }

    return this.getGenericProducts(limit);
  },

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

  getProductsByDosha(doshaType) {
    return PRODUCT_DATABASE.filter(product =>
      product.dosha.includes(doshaType)
    );
  },

  searchProducts(query) {
    const lowerQuery = query.toLowerCase();
    return PRODUCT_DATABASE.filter(product =>
      product.name.toLowerCase().includes(lowerQuery) ||
      product.benefit.toLowerCase().includes(lowerQuery)
    );
  },
};

module.exports = productService;