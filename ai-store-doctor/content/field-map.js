;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.content = ns.content || {}

  const PRODUCT_ROOT = [
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
    'form',
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

  const TITLE_FALLBACK = ['[class*="product-name" i]', '[class*="proName" i]', 'h1']

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

  const CATEGORY_TEXT = [
    '.category-breadcrumb',
    '[class*="breadcrumb" i]',
    '#category-path',
    '[data-field="category"]',
    '[class*="category-path" i]',
    '[class*="cate-path" i]',
  ]

  const TITLE_LABELS = [/产品名称/, /商品名称/, /商品标题/, /产品标题/, /product\s*name/i, /^title$/i]
  const CATEGORY_LABELS = [/产品目录/, /商品分类/, /产品分类/, /已选分类/, /category/i, /catalogue/i]

  const TITLE_JSON_KEYS = ['prodName', 'productName', 'productNameEn', 'enName', 'comName', 'subject', 'goodsName', 'title']
  const CATEGORY_JSON_KEYS = ['catName', 'categoryName', 'prodCatName', 'cateName', 'selectedCategory']
  const STATE_NAMES = ['__INITIAL_STATE__', '__PRELOADED_STATE__', 'pageData', 'productData', 'productForm']

  const GENERIC_FIELDS = {
    title: TITLE_INPUTS.concat(TITLE_FALLBACK),
    category: CATEGORY_SELECTED.concat(CATEGORY_CONTROLS).concat(CATEGORY_HIDDEN).concat(CATEGORY_TEXT),
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
      title: TITLE_INPUTS.concat(TITLE_FALLBACK),
      category: CATEGORY_SELECTED.concat(CATEGORY_CONTROLS).concat(CATEGORY_HIDDEN).concat(CATEGORY_TEXT),
      keywords: ['.keyword-tag', '[data-field="keywords"] .tag', '[data-field="keywords"] span', '.sr-keyword'].concat(
        GENERIC_FIELDS.keywords,
      ),
    }),
    PRODUCT_ROOT,
  )
  const VEMIC = pack(
    Object.assign({}, GENERIC_FIELDS, {
      title: ['input[name="subject"]', '#productName', 'input[name*="productName" i]'].concat(TITLE_INPUTS).concat(TITLE_FALLBACK),
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

  function clean(value) {
    if (ns.content.dom && typeof ns.content.dom.clean === 'function') return ns.content.dom.clean(value)
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function fieldValue(el) {
    if (ns.content.dom && typeof ns.content.dom.fieldValue === 'function') return ns.content.dom.fieldValue(el)
    if (!el) return ''
    const tag = String(el.tagName || '').toUpperCase()
    if (tag === 'INPUT' || tag === 'TEXTAREA') return clean(el.value)
    return clean(el.textContent)
  }

  function isWeakTitle(value) {
    const text = clean(value)
    if (!text || text.length < 2) return true
    return /^(编辑|发布|添加)?(商品|产品|产品信息|商品信息)?$|^(编辑商品|发布产品|添加产品|product\s*edit|edit\s*product)$/i.test(text)
  }

  function isWeakCategory(value) {
    const text = clean(value)
    if (!text) return true
    return /^(请选择|选择分类|选择目录|select|n\/?a|-)$/i.test(text)
  }

  function isWeak(field, value) {
    return field === 'category' ? isWeakCategory(value) : field === 'title' ? isWeakTitle(value) : !clean(value)
  }

  function firstFilled(root, selectors) {
    if (!root) return { el: null, selector: null, value: '' }
    const list = selectors || []
    for (let i = 0; i < list.length; i += 1) {
      try {
        const el = root.querySelector(list[i])
        const value = fieldValue(el)
        if (el && value) return { el: el, selector: list[i], value: value }
      } catch (e) {
        /* invalid selector */
      }
    }
    return { el: null, selector: null, value: '' }
  }

  function controlFromLabel(root, label) {
    if (!label) return null
    if (label.control && root.contains(label.control)) return label.control
    const htmlFor = label.getAttribute && label.getAttribute('for')
    if (htmlFor) {
      try {
        const linked = root.querySelector('#' + CSS.escape(htmlFor))
        if (linked) return linked
      } catch (e) {
        const fallback = root.querySelector('[id="' + htmlFor + '"]')
        if (fallback) return fallback
      }
    }
    const nested = label.querySelector && label.querySelector('input,textarea,select')
    if (nested) return nested
    let sib = label.nextElementSibling
    while (sib) {
      if (/^(INPUT|TEXTAREA|SELECT)$/i.test(sib.tagName)) return sib
      const child = sib.querySelector && sib.querySelector('input,textarea,select')
      if (child) return child
      if (sib.matches && sib.matches('.cate-selected,.selected-category,[class*="selected-cate" i]')) return sib
      sib = sib.nextElementSibling
    }
    const group = label.closest && label.closest('.form-item,.form-group,.field,tr,li,div')
    if (group && group !== root) {
      return (
        group.querySelector('input,textarea,select,.cate-selected,.selected-category,[class*="selected-cate" i]') || null
      )
    }
    return null
  }

  function findByLabel(root, patterns) {
    if (!root) return { el: null, selector: null, value: '' }
    const nodes = Array.from(root.querySelectorAll('label,.form-label,.field-label,th,dt,[class*="label" i]'))
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const nested = node.querySelector && node.querySelector('input,textarea,select')
      const text = clean(String(node.textContent || '').replace(fieldValue(nested), ''))
      if (!text || text.length > 48) continue
      const matched = patterns.some(function (re) {
        return re.test(text)
      })
      if (!matched) continue
      const el = controlFromLabel(root, node)
      const value = fieldValue(el)
      if (el && value) return { el: el, selector: 'label:' + text, value: value }
    }
    return { el: null, selector: null, value: '' }
  }

  function parseBalancedObject(text, start) {
    if (!text || text.charAt(start) !== '{') return null
    let depth = 0
    let inStr = false
    let quote = ''
    let escape = false
    for (let i = start; i < text.length; i += 1) {
      const ch = text.charAt(i)
      if (inStr) {
        if (escape) escape = false
        else if (ch === '\\') escape = true
        else if (ch === quote) inStr = false
        continue
      }
      if (ch === '"' || ch === "'") {
        inStr = true
        quote = ch
        continue
      }
      if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1))
          } catch (e) {
            return null
          }
        }
      }
    }
    return null
  }

  function walkKeys(obj, keys, depth) {
    if (!obj || typeof obj !== 'object' || depth > 6) return { value: '', key: '' }
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]
      if (typeof obj[key] === 'string' && obj[key].trim()) return { value: obj[key].trim(), key: key }
      if (obj[key] && typeof obj[key] === 'object' && typeof obj[key].name === 'string' && obj[key].name.trim()) {
        return { value: obj[key].name.trim(), key: key + '.name' }
      }
    }
    const children = Array.isArray(obj) ? obj : Object.keys(obj).map(function (k) { return obj[k] })
    for (let j = 0; j < children.length; j += 1) {
      const found = walkKeys(children[j], keys, depth + 1)
      if (found.value) return found
    }
    return { value: '', key: '' }
  }

  function collectStateBlobs(doc) {
    const blobs = []
    if (!doc) return blobs
    const win = doc.defaultView
    if (win) {
      STATE_NAMES.forEach(function (name) {
        if (win[name] && typeof win[name] === 'object') blobs.push(win[name])
      })
    }
    Array.from(doc.querySelectorAll('script')).forEach(function (script) {
      const text = String(script.textContent || '')
      const type = String(script.type || '').toLowerCase()
      if (type === 'application/json') {
        try {
          blobs.push(JSON.parse(text))
        } catch (e) {
          /* ignore */
        }
        return
      }
      if (type === 'application/ld+json') return
      STATE_NAMES.forEach(function (name) {
        const re = new RegExp('(?:window\\.)?' + name + '\\s*=\\s*\\{')
        const match = re.exec(text)
        if (!match) return
        const obj = parseBalancedObject(text, match.index + match[0].length - 1)
        if (obj) blobs.push(obj)
      })
    })
    return blobs
  }

  function readJsonldName(doc) {
    if (!doc) return { value: '', key: '' }
    const nodes = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    for (let i = 0; i < nodes.length; i += 1) {
      try {
        const value = JSON.parse(nodes[i].textContent)
        const items = Array.isArray(value) ? value : [value]
        for (let j = 0; j < items.length; j += 1) {
          const item = items[j]
          const type = item && item['@type']
          const isProduct = type === 'Product' || (Array.isArray(type) && type.indexOf('Product') !== -1)
          if (isProduct && item.name) return { value: clean(item.name), key: 'name' }
        }
      } catch (e) {
        /* ignore */
      }
    }
    return { value: '', key: '' }
  }

  function readKeyFromText(text, keys) {
    if (!text) return { value: '', key: '' }
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]
      const re = new RegExp('(?:["\']' + key + '["\']|' + key + ')\\s*:\\s*["\']([^"\']+)["\']')
      const match = re.exec(text)
      if (match && match[1]) return { value: match[1], key: key }
    }
    return { value: '', key: '' }
  }

  function readState(doc, keys) {
    const blobs = collectStateBlobs(doc)
    for (let i = 0; i < blobs.length; i += 1) {
      const found = walkKeys(blobs[i], keys, 0)
      if (found.value) return found
    }
    if (!doc) return { value: '', key: '' }
    const scripts = Array.from(doc.querySelectorAll('script'))
    for (let j = 0; j < scripts.length; j += 1) {
      const found = readKeyFromText(scripts[j].textContent, keys)
      if (found.value) return found
    }
    return { value: '', key: '' }
  }

  function resolveValue(root, doc, field, options) {
    const opts = options || {}
    const map = opts.map || {}
    const selectors = map[field] || []
    const labelPatterns = field === 'title' ? TITLE_LABELS : field === 'category' ? CATEGORY_LABELS : []
    const jsonKeys = field === 'title' ? TITLE_JSON_KEYS : field === 'category' ? CATEGORY_JSON_KEYS : []
    const inputCount = field === 'title' ? TITLE_INPUTS.length : CATEGORY_SELECTED.length + CATEGORY_CONTROLS.length + CATEGORY_HIDDEN.length
    const primary = field === 'title' || field === 'category' ? selectors.slice(0, inputCount) : selectors
    const fallback = field === 'title' || field === 'category' ? selectors.slice(inputCount) : []

    const hitPrimary = firstFilled(root, primary)
    if (hitPrimary.value && !isWeak(field, hitPrimary.value)) {
      return { value: hitPrimary.value, source: hitPrimary.selector, stage: 'input' }
    }

    const hitLabel = findByLabel(root, labelPatterns)
    if (hitLabel.value && !isWeak(field, hitLabel.value)) {
      return { value: hitLabel.value, source: hitLabel.selector, stage: 'label' }
    }

    const state = readState(doc, jsonKeys)
    if (state.value && !isWeak(field, state.value)) {
      return { value: clean(state.value), source: 'json:' + state.key, stage: 'json' }
    }

    if (field === 'title') {
      const ld = readJsonldName(doc)
      if (ld.value && !isWeak(field, ld.value)) {
        return { value: ld.value, source: 'jsonld:' + ld.key, stage: 'json' }
      }
    }

    const hitFallback = firstFilled(root, fallback.length ? fallback : primary)
    if (hitFallback.value && !isWeak(field, hitFallback.value)) {
      return { value: hitFallback.value, source: hitFallback.selector, stage: 'fallback' }
    }
    return { value: '', source: null, stage: '' }
  }

  ns.content.fieldMap = {
    GENERIC: GENERIC,
    MIC: MIC,
    VEMIC: VEMIC,
    SITES: SITES,
    TITLE_INPUTS: TITLE_INPUTS,
    TITLE_FALLBACK: TITLE_FALLBACK,
    TITLE_LABELS: TITLE_LABELS,
    TITLE_JSON_KEYS: TITLE_JSON_KEYS,
    CATEGORY_SELECTED: CATEGORY_SELECTED,
    CATEGORY_CONTROLS: CATEGORY_CONTROLS,
    CATEGORY_HIDDEN: CATEGORY_HIDDEN,
    CATEGORY_TEXT: CATEGORY_TEXT,
    CATEGORY_LABELS: CATEGORY_LABELS,
    CATEGORY_JSON_KEYS: CATEGORY_JSON_KEYS,
    detectSite: detectSite,
    mapFor: mapFor,
    rootsFor: rootsFor,
    resolveValue: resolveValue,
    firstFilled: firstFilled,
    findByLabel: findByLabel,
    isWeakTitle: isWeakTitle,
    isWeakCategory: isWeakCategory,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
