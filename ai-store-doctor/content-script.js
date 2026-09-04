const SELECTORS = {
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
  keywords: ['.keyword-tag', '[class*="keyword" i] .tag', '[data-field="keywords"] .tag', 'input[name*="keyword" i]'],
  certifications: ['input[name*="certif" i]:checked', '[class*="certif" i] input:checked'],
}
const clean = (v) =>
  String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
const unique = (values) => [...new Set(values.filter(Boolean))]
function first(doc, list) {
  for (const selector of list) {
    const element = doc.querySelector(selector)
    if (element) return element
  }
  return null
}
function all(doc, list) {
  return unique(list.flatMap((selector) => Array.from(doc.querySelectorAll(selector))))
}
function documents() {
  const result = [document]
  const visit = (doc) =>
    Array.from(doc.querySelectorAll('iframe,frame')).forEach((frame) => {
      try {
        const child = frame.contentDocument
        if (child && !result.includes(child)) {
          result.push(child)
          visit(child)
        }
      } catch {}
    })
  visit(document)
  return result
}
function controlValue(control) {
  if (control.tagName === 'SELECT')
    return clean(
      Array.from(control.selectedOptions)
        .map((x) => x.textContent)
        .join(', '),
    )
  if (/checkbox|radio/i.test(control.type)) return control.checked ? clean(control.value || '已选择') : ''
  return clean(control.value)
}
function controlLabel(doc, control) {
  const own = clean(control.getAttribute('aria-label') || control.getAttribute('placeholder'))
  if (own) return own
  const wrapped = clean(control.closest('label')?.textContent)
  if (wrapped) return wrapped.replace(controlValue(control), '').trim()
  if (control.id) {
    try {
      const linked = doc.querySelector(`label[for="${CSS.escape(control.id)}"]`)
      if (linked) return clean(linked.textContent)
    } catch {}
  }
  return clean(control.name || control.id)
}
function extractOne(doc) {
  const titleEl = first(doc, SELECTORS.title),
    categoryEl = first(doc, SELECTORS.category),
    keywordEls = all(doc, SELECTORS.keywords),
    certEls = all(doc, SELECTORS.certifications)
  const jsonLd = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).flatMap((node) => {
    try {
      const value = JSON.parse(node.textContent)
      return Array.isArray(value) ? value : [value]
    } catch {
      return []
    }
  })
  const productLd =
    jsonLd.find(
      (item) => item?.['@type'] === 'Product' || (Array.isArray(item?.['@type']) && item['@type'].includes('Product')),
    ) || {}
  const organizationLd =
    jsonLd.find((item) => ['Organization', 'Corporation', 'LocalBusiness'].includes(item?.['@type'])) ||
    productLd.manufacturer ||
    productLd.brand ||
    {}
  const tableRows = Array.from(doc.querySelectorAll('table tr'))
    .map((row) =>
      Array.from(row.querySelectorAll('th,td'))
        .map((cell) => clean(cell.textContent))
        .filter(Boolean),
    )
    .filter((cells) => cells.length >= 2 && cells.length <= 10)
    .map((cells) => cells.join('：'))
  const definitions = Array.from(doc.querySelectorAll('dt'))
    .map((dt) =>
      dt.nextElementSibling?.tagName === 'DD'
        ? `${clean(dt.textContent)}：${clean(dt.nextElementSibling.textContent)}`
        : '',
    )
    .filter(Boolean)
  const properties = Array.isArray(productLd.additionalProperty)
    ? productLd.additionalProperty.map((p) => `${clean(p.name || p.propertyID || '属性')}：${clean(p.value)}`)
    : []
  const formFields = Array.from(doc.querySelectorAll('input:not([type="hidden"]):not([type="file"]),textarea,select'))
    .map((control) => {
      const value = controlValue(control)
      const label = controlLabel(doc, control)
      return value && label && value !== label ? `${label}：${value}` : ''
    })
    .filter(
      (row) => row.length >= 3 && row.length <= 1000 && !/\.(?:jpe?g|png|gif|webp|bmp|svg|avif)(?:\?|$)/i.test(row),
    )
  const keywords = keywordEls
    .flatMap((el) =>
      controlValue(el)
        .split(/[,，;；\n]/)
        .map(clean),
    )
    .filter(Boolean)
  const images = Array.from(doc.images)
    .map((img) => ({ src: img.currentSrc || img.src || '' }))
    .filter((img) => img.src)
    .slice(0, 30)
  const main = doc.querySelector('main,[role="main"],#content,.main-content,.product-main,form') || doc.body
  const companyHeading = Array.from(doc.querySelectorAll('h1,h2,h3,h4,[class*="title" i]')).find((el) =>
    /company profile|about us|公司简介|供应商信息/i.test(el.textContent),
  )
  const companyBlock =
    companyHeading?.closest('section,article,div') ||
    doc.querySelector('[class*="company-profile" i],[class*="company-info" i],[class*="supplier-info" i]')
  const companyName = clean(
    organizationLd.name || doc.querySelector('[class*="company-name" i],[class*="supplier-name" i]')?.textContent,
  )
  return {
    title: clean(productLd.name || (titleEl && ('value' in titleEl ? titleEl.value : titleEl.textContent))),
    category: clean(categoryEl?.textContent),
    keywords,
    certifications: certEls.map((el) => clean(el.value || el.name)),
    specs: unique([...tableRows, ...definitions, ...properties, ...formFields]).filter((row) => row.length <= 1000),
    formFields: unique(formFields),
    description: clean(productLd.description || doc.querySelector('meta[name="description"]')?.content),
    sku: clean(productLd.sku || productLd.mpn),
    brand: clean(typeof productLd.brand === 'string' ? productLd.brand : productLd.brand?.name),
    companyName,
    companyProfile: clean(organizationLd.description || companyBlock?.textContent).slice(0, 6000),
    visibleText: clean(main?.textContent).slice(0, 30000),
    images,
    pageTitle: clean(doc.title),
  }
}
function extractFields() {
  const parts = documents().map(extractOne)
  const pick = (key) => parts.map((x) => x[key]).find(Boolean) || null
  return {
    title: pick('title'),
    category: pick('category'),
    keywords: unique(parts.flatMap((x) => x.keywords)),
    specs: unique(parts.flatMap((x) => x.specs)).slice(0, 240),
    formFields: unique(parts.flatMap((x) => x.formFields)).slice(0, 240),
    certifications: unique(parts.flatMap((x) => x.certifications)),
    description: pick('description'),
    sku: pick('sku'),
    brand: pick('brand'),
    companyName: pick('companyName'),
    companyProfile: pick('companyProfile'),
    visibleText: unique(parts.map((x) => x.visibleText))
      .join('\n')
      .slice(0, 40000),
    images: parts.flatMap((x) => x.images).slice(0, 40),
    pageTitle: pick('pageTitle'),
    frameCount: parts.length,
    readAt: new Date().toISOString(),
    url: location.href,
  }
}
function collectDualTrack() {
  let fields = extractFields()
  let product = ASD.content && ASD.content.extractors ? ASD.content.extractors.extractAll() : null
  if (product && ASD.productFields) {
    product.debug.oldFieldCount = ASD.productFields.countOldFields(fields)
    product.debug.newFieldCount = ASD.productFields.countNewFields(product)
  }
  if (ASD.sanitize) {
    const sanitized = ASD.sanitize.sanitizeCollected({ fields: fields, product: product })
    fields = sanitized.fields
    product = sanitized.product
  }
  const loginRequired =
    ASD.content && ASD.content.dom ? ASD.content.dom.detectLoginRequired(product) : false
  return { fields, product, loginRequired }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'EXTRACT_MIC_FIELDS') {
    const collected = collectDualTrack()
    sendResponse(
      collected.loginRequired
        ? { loginRequired: true, url: location.href }
        : { fields: collected.fields, product: collected.product, url: location.href },
    )
  }
})
