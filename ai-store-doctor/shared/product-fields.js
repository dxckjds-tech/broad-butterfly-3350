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

  ns.productFields = {
    emptyProduct,
    emptyBundle,
    isFilled,
    countProductFields,
    countOldFields,
    countNewFields,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
