;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.content = ns.content || {}

  const GENERIC = {
    title: [
      'input[name="subject"]',
      'input[name*="productName" i]',
      'input[id*="productName" i]',
      'input[name*="title" i]',
      'input[id*="title" i]',
      'textarea[name*="title" i]',
      'h1',
    ],
    category: [
      '.category-breadcrumb',
      '[class*="breadcrumb" i]',
      '#category-path',
      '[data-field="category"]',
      '[class*="category-path" i]',
    ],
    keywords: [
      '.keyword-tag',
      '[data-field="keywords"] .tag',
      '[class*="keyword" i] .tag',
      'input[name*="keyword" i]',
      '[data-field="keywords"] span',
    ],
    brand: ['input[name*="brand" i]', '[data-field="brand"]', '[class*="brand-name" i]'],
    sku: ['input[name*="sku" i]', 'input[name*="mpn" i]', '[data-field="sku"]'],
    model: ['input[name*="model" i]', '[data-field="model"]'],
    price: ['input[name*="price" i]', '[class*="price" i]', '[data-field="price"]'],
    moq: ['input[name*="moq" i]', '[class*="moq" i]', '[class*="min-order" i]'],
    material: ['textarea[name*="material" i]', 'input[name*="material" i]'],
    size: ['input[name*="size" i]', 'input[name*="dimension" i]'],
    power: ['input[name*="power" i]', 'input[name*="watt" i]'],
    voltage: ['input[name*="voltage" i]'],
    capacity: ['input[name*="capacity" i]'],
    description: ['textarea[name*="desc" i]', '[data-field="description"]'],
    certifications: ['input[name*="certif" i]:checked', '[class*="certif" i] input:checked'],
    applications: ['select[name*="application" i]', 'input[name*="application" i]'],
    packaging: ['input[name*="packag" i]', 'textarea[name*="packag" i]'],
    deliveryTime: ['input[name*="deliver" i]', 'input[name*="lead" i]'],
    companyName: ['[class*="company-name" i]', '[class*="supplier-name" i]'],
    companyProfile: ['[class*="company-profile" i]', '[class*="company-info" i]', '[class*="supplier-info" i]'],
  }

  const MIC = Object.assign({}, GENERIC, {
    title: ['h1', '[class*="product-name" i]', '[class*="proName" i]'].concat(GENERIC.title),
    keywords: ['.keyword-tag', '[data-field="keywords"] .tag', '[data-field="keywords"] span', '.sr-keyword'].concat(
      GENERIC.keywords,
    ),
  })

  const VEMIC = Object.assign({}, GENERIC, {
    title: ['input[name="subject"]', '#productName', 'input[name*="productName" i]'].concat(GENERIC.title),
    keywords: ['input[name="keywords"]', 'input[name*="keyword" i]'].concat(GENERIC.keywords),
  })

  function detectSite(hostname) {
    const host = String(hostname || '').toLowerCase()
    if (host === 'vemic.com' || host.endsWith('.vemic.com')) return 'vemic'
    if (host === 'made-in-china.com' || host.endsWith('.made-in-china.com')) return 'mic'
    return 'generic'
  }

  function mapFor(site) {
    if (site === 'vemic') return VEMIC
    if (site === 'mic') return MIC
    return GENERIC
  }

  ns.content.fieldMap = { GENERIC, MIC, VEMIC, detectSite, mapFor }
})(typeof globalThis !== 'undefined' ? globalThis : self)
