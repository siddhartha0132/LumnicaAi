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