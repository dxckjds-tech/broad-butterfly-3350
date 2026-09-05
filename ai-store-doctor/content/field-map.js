;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.content = ns.content || {}

  const PRODUCT_ROOT = [
    '#productForm',
    'form.product-main',
    'form[id*="product" i]',
    'form[class*="product" i]',
    '.product-main',
    '[class*="product-detail" i]',
    '[class*="prod-detail" i]',
    'article.main-content',
    'main.product-main',
    'main',
    '[role="main"]',
    '#content',
    '.main-content',
    'form',
  ]

  const GENERIC_FIELDS = {
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
    specifications: ['table tr', 'dt'],
    certifications: ['input[name*="certif" i]:checked', '[class*="certif" i] input:checked'],
    applications: ['select[name*="application" i]', 'input[name*="application" i]'],
    packaging: ['input[name*="packag" i]', 'textarea[name*="packag" i]'],
    deliveryTime: ['input[name*="deliver" i]', 'input[name*="lead" i]'],
    companyName: ['[class*="company-name" i]', '[class*="supplier-name" i]'],
    companyProfile: ['[class*="company-profile" i]', '[class*="company-info" i]', '[class*="supplier-info" i]'],
  }

  function pack(fields, roots) {
    return Object.assign({ productRoot: roots.slice() }, fields)
  }

  const GENERIC = pack(GENERIC_FIELDS, PRODUCT_ROOT)
  const MIC = pack(
    Object.assign({}, GENERIC_FIELDS, {
      title: ['h1', '[class*="product-name" i]', '[class*="proName" i]'].concat(GENERIC_FIELDS.title),
      keywords: ['.keyword-tag', '[data-field="keywords"] .tag', '[data-field="keywords"] span', '.sr-keyword'].concat(
        GENERIC_FIELDS.keywords,
      ),
    }),
    PRODUCT_ROOT,
  )
  const VEMIC = pack(
    Object.assign({}, GENERIC_FIELDS, {
      title: ['input[name="subject"]', '#productName', 'input[name*="productName" i]'].concat(GENERIC_FIELDS.title),
      keywords: ['input[name="keywords"]', 'input[name*="keyword" i]'].concat(GENERIC_FIELDS.keywords),
    }),
    PRODUCT_ROOT,
  )

  const SITES = {
    'made-in-china.com': MIC,
    'vemic.com': VEMIC,
    generic: GENERIC,
  }

  function detectSite(hostname) {
    const host = String(hostname || '').toLowerCase()
    if (host === 'vemic.com' || host.endsWith('.vemic.com')) return 'vemic'
    if (host === 'made-in-china.com' || host.endsWith('.made-in-china.com')) return 'mic'
    return 'generic'
  }

  function sitePack(site) {
    if (site === 'vemic') return VEMIC
    if (site === 'mic') return MIC
    return GENERIC
  }

  function mapFor(site) {
    const source = sitePack(site)
    const fields = {}
    Object.keys(source).forEach(function (key) {
      if (key !== 'productRoot') fields[key] = source[key]
    })
    return fields
  }

  function rootsFor(site) {
    return (sitePack(site).productRoot || PRODUCT_ROOT).slice()
  }

  ns.content.fieldMap = {
    GENERIC: GENERIC,
    MIC: MIC,
    VEMIC: VEMIC,
    SITES: SITES,
    detectSite: detectSite,
    mapFor: mapFor,
    rootsFor: rootsFor,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
