;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  function emptyProduct() {
    return {
      name: null,
      category: null,
      model: null,
      brand: null,
      sku: null,
      keywords: [],
      price: null,
      moq: null,
      attributes: [],
      specifications: [],
      description: null,
      material: null,
      size: null,
      power: null,
      voltage: null,
      capacity: null,
      applications: [],
      certifications: [],
      packaging: null,
      deliveryTime: null,
    }
  }

  function emptyBundle() {
    return {
      product: emptyProduct(),
      company: { name: null, profile: null },
      current: { title: null, keywords: [], description: null },
      fallbackText: '',
      images: [],
      debug: {
        productRootFound: false,
        degraded: false,
        completeProduct: false,
        site: 'generic',
        oldFieldCount: 0,
        newFieldCount: 0,
        selectorHits: {
          title: null,
          category: null,
          keywords: null,
          description: null,
          specifications: null,
          company: null,
          productRoot: null,
        },
        qualityScore: 0,
        collectGaps: [],
      },
    }
  }

  function isFilled(value) {
    if (Array.isArray(value)) return value.length > 0
    return value != null && String(value).trim() !== ''
  }

  function countProductFields(product) {
    if (!product) return 0
    return Object.keys(product).reduce(function (n, key) {
      return n + (isFilled(product[key]) ? 1 : 0)
    }, 0)
  }

  function countOldFields(fields) {
    if (!fields) return 0
    const keys = [
      'title',
      'category',
      'keywords',
      'specs',
      'formFields',
      'certifications',
      'description',
      'sku',
      'brand',
      'companyName',
      'companyProfile',
      'visibleText',
      'images',
    ]
    return keys.reduce(function (n, key) {
      return n + (isFilled(fields[key]) ? 1 : 0)
    }, 0)
  }

  function countNewFields(bundle) {
    if (!bundle) return 0
    return (
      countProductFields(bundle.product) +
      (isFilled(bundle.company && bundle.company.name) ? 1 : 0) +
      (isFilled(bundle.company && bundle.company.profile) ? 1 : 0) +
      (isFilled(bundle.fallbackText) ? 1 : 0)
    )
  }

  function qualityScore(fields, bundle) {
    const product = (bundle && bundle.product) || {}
    const debug = (bundle && bundle.debug) || {}
    let score = 0
    if (isFilled(product.name) || isFilled(fields && fields.title)) score += 20
    if (isFilled(product.category) || isFilled(fields && fields.category)) score += 10
    const keywords =
      (product.keywords && product.keywords.length) || (fields && fields.keywords && fields.keywords.length) || 0
    if (keywords) score += 10
    const specCount =
      (product.specifications && product.specifications.length) || (fields && fields.specs && fields.specs.length) || 0
    score += Math.min(25, specCount * 5)
    if (isFilled(product.description) || isFilled(fields && fields.description)) score += 15
    if (debug.productRootFound) score += 10
    const images =
      (bundle && bundle.images && bundle.images.length) || (fields && fields.images && fields.images.length) || 0
    if (images) score += 10
    return score
  }

  function hasCoreFields(fields, bundle) {
    const product = (bundle && bundle.product) || {}
    const name = isFilled(product.name) || isFilled(fields && fields.title)
    const extra = !!(
      (product.keywords && product.keywords.length) ||
      (product.specifications && product.specifications.length) ||
      isFilled(product.sku) ||
      isFilled(product.description) ||
      (fields && fields.specs && fields.specs.length) ||
      isFilled(fields && fields.description)
    )
    return !!(name && extra)
  }

  function collectGaps(fields, bundle) {
    const product = (bundle && bundle.product) || {}
    const debug = (bundle && bundle.debug) || {}
    const gaps = []
    if (!debug.productRootFound) gaps.push('productRoot')
    if (!isFilled(product.name) && !isFilled(fields && fields.title)) gaps.push('title')
    if (!isFilled(product.category) && !isFilled(fields && fields.category)) gaps.push('category')
    const specCount =
      (product.specifications && product.specifications.length) || (fields && fields.specs && fields.specs.length) || 0
    if (!specCount) gaps.push('specifications')
    if (!isFilled(product.description) && !isFilled(fields && fields.description)) gaps.push('description')
    const newCount = debug.newFieldCount || countNewFields(bundle)
    if (newCount < 4) gaps.push('newFieldCount')
    return gaps
  }

  ns.productFields = {
    emptyProduct,
    emptyBundle,
    isFilled,
    countProductFields,
    countOldFields,
    countNewFields,
    qualityScore,
    hasCoreFields,
    collectGaps,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
