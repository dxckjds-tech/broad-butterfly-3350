;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.content = ns.content || {}

  const PRODUCT_CONTROLS = 'form:has(textarea),form:has(table),form:has(input[name*="prod" i]),form:has(input[name*="product" i]),form:has(input[name*="subject" i]),form:has(input[name="prodName"])'

  const PRODUCT_ROOT_SAFE = [
    '#productForm',
    '#prodEditForm',
    'form.product-edit-form',
    'form.product-main',
    'form[id*="product" i]',
    'form[id*="prod" i]',
    'form[class*="product" i]',
    'form[class*="prod-edit" i]',
    '.product-edit-form',
    '.product-main',
    '[class*="product-edit" i]',
    '[class*="product-detail" i]',
    '[class*="prod-detail" i]',
    'article.main-content',
    'main.product-main',
    'main',
    '[role="main"]',
    '#content',
    '.main-content',
    PRODUCT_CONTROLS,
  ]

  const MEMBERCENTER_ROOT = [
    '#productForm',
    '#prodEditForm',
    'form.product-edit-form',
    'form[id*="product" i]',
    'form[id*="prod" i]',
    '.product-edit-form',
    '[class*="product-edit" i]',
    PRODUCT_CONTROLS,
  ]

  const TITLE_INPUTS = [
    'input[name="prodName"]',
    'input[id="prodName"]',
    'textarea[name="prodName"]',
    'input[name="prod_name"]',
    'input[name="enName"]',
    'input[id="enName"]',
    'input[name="productNameEn"]',
    'input[name="comName"]',
    'input[name*="prodName" i]',
    'input[id*="prodName" i]',
    'input[name="subject"]',
    'input[name*="productName" i]',
    'input[id*="productName" i]',
    'input[name*="goodsName" i]',
    'input[name*="goodName" i]',
    'input[name*="subject" i]',
    'input[name*="title" i]',
    'input[id*="title" i]',
    'textarea[name*="title" i]',
  ]

  const TITLE_FALLBACK_FRONT = ['[class*="product-name" i]', '[class*="proName" i]', 'h1']
  const TITLE_FALLBACK_NONE = []

  const CATEGORY_SELECTED = [
    '.cate-selected',
    '.selected-category',
    '.selected-cate',
    '[class*="selected-cate" i]',
    '[class*="cate-selected" i]',
    '[class*="category-selected" i]',
    '[data-field="selected-category"]',
  ]

  const CATEGORY_CONTROLS = [
    'select[name="catName"]',
    'select[name*="category" i]',
    'select[name*="catName" i]',
    'select[id*="category" i]',
    'input[name="catName"]:not([type="hidden"])',
    'input[id="catName"]',
    'input[name="categoryName"]:not([type="hidden"])',
    'input[name="prodCatName"]',
    'input[name="cateName"]',
    'input[name*="catName" i]:not([type="hidden"])',
  ]

  const CATEGORY_HIDDEN = [
    'input[type="hidden"][name="catName"]',
    'input[type="hidden"][name="categoryName"]',
    'input[type="hidden"][name="prodCatName"]',
    'input[type="hidden"][name="cateName"]',
    'input[name="catCode"]',
    'input[type="hidden"][name="catCode"]',
  ]

  const CATEGORY_TEXT_FRONT = [
    '.category-breadcrumb',
    '[class*="breadcrumb" i]',
    '#category-path',
    '[data-field="category"]',
    '[class*="category-path" i]',
    '[class*="cate-path" i]',
  ]

  const TITLE_JSON_KEYS = ['prodName', 'productName', 'productNameEn', 'enName', 'comName', 'subject', 'goodsName', 'title']
  const CATEGORY_JSON_KEYS = ['catName', 'categoryName', 'prodCatName', 'cateName', 'selectedCategory']
  const KEYWORD_JSON_KEYS = ['keywords', 'keyword', 'searchTerms']

  const GENERIC_FIELDS = {
    title: TITLE_INPUTS.concat(TITLE_FALLBACK_FRONT),
    category: CATEGORY_SELECTED.concat(CATEGORY_CONTROLS).concat(CATEGORY_HIDDEN).concat(CATEGORY_TEXT_FRONT),
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

  const MEMBERCENTER_FIELDS = Object.assign({}, GENERIC_FIELDS, {
    title: TITLE_INPUTS.slice(),
    category: CATEGORY_SELECTED.concat(CATEGORY_CONTROLS).concat(CATEGORY_HIDDEN),
    keywords: [
      'input[name*="keyword" i]',
      'textarea[name*="keyword" i]',
      '.keyword-tag',
      '[data-field="keywords"] .tag',
      '[data-field="keywords"] span',
      '.sr-keyword',
    ],
  })

  function pack(fields, roots) {
    return Object.assign({ productRoot: roots.slice() }, fields)
  }

  const GENERIC = pack(GENERIC_FIELDS, PRODUCT_ROOT_SAFE)
  const MIC_DETAIL = pack(GENERIC_FIELDS, PRODUCT_ROOT_SAFE)
  const MIC_EDIT = pack(MEMBERCENTER_FIELDS, MEMBERCENTER_ROOT)
  const MIC_LIST = pack(GENERIC_FIELDS, ['main', '[role="main"]', '.product-list', '#content'])
  const VEMIC = pack(
    Object.assign({}, GENERIC_FIELDS, {
      title: ['input[name="subject"]', '#productName', 'input[name*="productName" i]'].concat(TITLE_INPUTS).concat(TITLE_FALLBACK_FRONT),
      keywords: ['input[name="keywords"]', 'input[name*="keyword" i]'].concat(GENERIC_FIELDS.keywords),
    }),
    PRODUCT_ROOT_SAFE,
  )

  const SITES = {
    'made-in-china.com': MIC_DETAIL,
    'vemic.com': VEMIC,
    generic: GENERIC,
  }

  function familyOf(hostname) {
    const host = String(hostname || '').toLowerCase()
    if (host === 'vemic.com' || host.endsWith('.vemic.com')) return 'vemic'
    if (host === 'made-in-china.com' || host.endsWith('.made-in-china.com')) return 'mic'
    return 'generic'
  }

  function detectPageProfile(hostname, pathname) {
    const family = familyOf(hostname)
    const path = String(pathname || '').toLowerCase()
    if (family === 'vemic') return { id: 'vemic', family: 'vemic' }
    if (family === 'mic') {
      const member = /membercenter/.test(String(hostname || '').toLowerCase()) || /\/productmanage|\/vo\/|\/virtualoffice/.test(path)
      if (member) {
        if (/\/(list|manage|search)|productlist|prodlist/.test(path) && !/edit|update|modify/.test(path)) {
          return { id: 'mic-membercenter-list', family: 'mic' }
        }
        return { id: 'mic-membercenter-edit', family: 'mic' }
      }
      if (/\/product\//.test(path) || /product-detail|prod-detail/.test(path)) return { id: 'mic-detail', family: 'mic' }
      return { id: 'mic-detail', family: 'mic' }
    }
    return { id: 'generic', family: 'generic' }
  }

  function detectSite(hostname, pathname) {
    if (arguments.length > 1 || (typeof hostname === 'string' && hostname.indexOf('/') !== -1)) {
      return detectPageProfile(hostname, pathname).id
    }
    return familyOf(hostname)
  }

  function sitePack(site) {
    if (site === 'vemic') return VEMIC
    if (site === 'mic-membercenter-edit') return MIC_EDIT
    if (site === 'mic-membercenter-list') return MIC_LIST
    if (site === 'mic-detail' || site === 'mic') return MIC_DETAIL
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
    return (sitePack(site).productRoot || PRODUCT_ROOT_SAFE).slice()
  }

  function jsonKeysFor(field) {
    if (field === 'title' || field === 'productName' || field === 'name') return TITLE_JSON_KEYS
    if (field === 'category') return CATEGORY_JSON_KEYS
    if (field === 'keywords') return KEYWORD_JSON_KEYS
    return []
  }

  function frontendSelectors(field, profile) {
    if (profile === 'mic-membercenter-edit') return []
    if (field === 'title') return TITLE_FALLBACK_FRONT
    if (field === 'category') return CATEGORY_TEXT_FRONT
    return []
  }

  function resolveValue(root, doc, field, options) {
    const opts = options || {}
    const profile = opts.profile || (opts.site && String(opts.site)) || 'generic'
    if (ns.fieldResolution && typeof ns.fieldResolution.resolveField === 'function') {
      const resolved = ns.fieldResolution.resolveField(root, doc, field, {
        map: opts.map || {},
        profile: profile,
        jsonKeys: jsonKeysFor(field),
        frontendSelectors: frontendSelectors(field, profile),
      })
      return {
        value: resolved.value || '',
        source: resolved.selector || null,
        stage: resolved.strategy || resolved.tier || '',
        hit: resolved,
      }
    }
    const hit = (ns.fieldResolution && ns.fieldResolution.firstFilled
      ? ns.fieldResolution.firstFilled
      : function () {
          return { value: '', selector: null }
        })(root, (opts.map && opts.map[field]) || [])
    return { value: hit.value || '', source: hit.selector, stage: 'fallback', hit: hit }
  }

  ns.content.fieldMap = {
    GENERIC: GENERIC,
    MIC: MIC_DETAIL,
    MIC_EDIT: MIC_EDIT,
    MIC_LIST: MIC_LIST,
    VEMIC: VEMIC,
    SITES: SITES,
    TITLE_INPUTS: TITLE_INPUTS,
    TITLE_FALLBACK: TITLE_FALLBACK_FRONT,
    TITLE_FALLBACK_NONE: TITLE_FALLBACK_NONE,
    TITLE_JSON_KEYS: TITLE_JSON_KEYS,
    CATEGORY_SELECTED: CATEGORY_SELECTED,
    CATEGORY_CONTROLS: CATEGORY_CONTROLS,
    CATEGORY_HIDDEN: CATEGORY_HIDDEN,
    CATEGORY_TEXT: CATEGORY_TEXT_FRONT,
    CATEGORY_JSON_KEYS: CATEGORY_JSON_KEYS,
    detectSite: detectSite,
    detectPageProfile: detectPageProfile,
    familyOf: familyOf,
    mapFor: mapFor,
    rootsFor: rootsFor,
    resolveValue: resolveValue,
    jsonKeysFor: jsonKeysFor,
    firstFilled: function (root, selectors) {
      return ns.fieldResolution ? ns.fieldResolution.firstFilled(root, selectors) : { el: null, selector: null, value: '' }
    },
    isWeakTitle: function (value) {
      return ns.fieldResolution ? ns.fieldResolution.isWeakTitle(value) : !value
    },
    isWeakCategory: function (value) {
      return ns.fieldResolution ? ns.fieldResolution.isWeakCategory(value) : !value
    },
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
