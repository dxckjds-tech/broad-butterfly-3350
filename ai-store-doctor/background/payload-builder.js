;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const IMAGE_FILE_PATTERN = /(?:https?:\/\/\S+|[\w%()+,.@-]+)\.(?:jpe?g|png|gif|webp|bmp|svg|avif)(?:\?\S*)?/gi

  function stripImageNames(value) {
    return String(value || '')
      .replace(IMAGE_FILE_PATTERN, '[图片内容由视觉模型单独识别]')
      .replace(/C:\\fakepath\\[^\s,;]+/gi, '[已移除图片文件名]')
  }

  function cleanEvidenceRows(rows) {
    return (rows || [])
      .map(stripImageNames)
      .filter((row) => !/^[^：:]{0,30}[：:]\s*\[(?:图片内容|已移除图片文件名)/.test(row))
  }

  function sanitizeModelEvidence(result) {
    if (!result || typeof result !== 'object') return result
    const hasFileName = (value) =>
      /\.(?:jpe?g|png|gif|webp|bmp|svg|avif)(?:\?|\b)/i.test(String(value || '')) ||
      /图片文件名|image filename/i.test(String(value || ''))
    for (const candidate of result.identityCandidates || []) {
      candidate.support = (candidate.support || []).filter((item) => !hasFileName(item))
      candidate.oppose = (candidate.oppose || []).filter((item) => !hasFileName(item))
    }
    return result
  }

  function compactFields(source) {
    const compact = {
      title: stripImageNames(source.title),
      category: stripImageNames(source.category),
      keywords: cleanEvidenceRows(source.keywords),
      specs: cleanEvidenceRows(source.specs).slice(0, 120),
      formFields: cleanEvidenceRows(source.formFields).slice(0, 120),
      certifications: cleanEvidenceRows(source.certifications),
      description: stripImageNames(source.description).slice(0, 5000),
      sku: stripImageNames(source.sku),
      brand: stripImageNames(source.brand),
      companyName: stripImageNames(source.companyName),
      companyProfile: stripImageNames(source.companyProfile).slice(0, 6000),
      visibleText: stripImageNames(source.visibleText).slice(0, 15000),
      imageCount: (source.images || []).length,
      frameCount: source.frameCount,
      url: source.url,
    }
    compact.userConfirmedIdentity = source.userConfirmedIdentity || null
    return compact
  }

  const MAX_PAYLOAD_CHARS = 28000

  function stringifyChecked(obj) {
    const text = JSON.stringify(obj)
    try {
      JSON.parse(text)
    } catch (error) {
      throw new Error('PAYLOAD_NOT_JSON')
    }
    return text
  }

  function cloneJson(obj) {
    return JSON.parse(JSON.stringify(obj))
  }

  function hasProductBundle(bundle) {
    const product = bundle && bundle.product
    if (!product) return false
    return !!(
      product.name ||
      product.sku ||
      (product.keywords && product.keywords.length) ||
      (product.specifications && product.specifications.length)
    )
  }

  function productPayload(bundle, fields) {
    const product = bundle.product || {}
    return {
      product: {
        name: product.name || null,
        category: product.category || null,
        model: product.model || null,
        brand: product.brand || null,
        sku: product.sku || null,
        keywords: product.keywords || [],
        price: product.price || null,
        moq: product.moq || null,
        attributes: product.attributes || [],
        specifications: product.specifications || [],
        description: stripImageNames(product.description || ''),
        material: product.material || null,
        size: product.size || null,
        power: product.power || null,
        voltage: product.voltage || null,
        capacity: product.capacity || null,
        applications: product.applications || [],
        certifications: product.certifications || [],
        packaging: product.packaging || null,
        deliveryTime: product.deliveryTime || null,
      },
      company: bundle.company || { name: null, profile: null },
      current: bundle.current || { title: null, keywords: [], description: null },
      fallbackText: stripImageNames(bundle.fallbackText || ''),
      userConfirmedIdentity: (fields && fields.userConfirmedIdentity) || null,
    }
  }

  function enforceBudget(obj) {
    const next = cloneJson(obj)
    const truncated = {}
    let text = stringifyChecked(next)
    if (text.length > MAX_PAYLOAD_CHARS && next.fallbackText) {
      truncated.fallbackText = true
      truncated.fallbackTextOriginal = next.fallbackText.length
      next.fallbackText = next.fallbackText.slice(0, 400)
      text = stringifyChecked(next)
    }
    if (text.length > MAX_PAYLOAD_CHARS && next.product) {
      const specs = next.product.specifications || []
      if (specs.length > 24) {
        truncated.specifications = { original: specs.length, sent: 24 }
        next.product.specifications = specs.slice(0, 24)
      }
      const attrs = next.product.attributes || []
      if (attrs.length > 12) {
        truncated.attributes = { original: attrs.length, sent: 12 }
        next.product.attributes = attrs.slice(0, 12)
      }
      text = stringifyChecked(next)
    }
    if (text.length > MAX_PAYLOAD_CHARS && next.company && next.company.profile) {
      truncated.companyProfile = true
      next.company.profile = String(next.company.profile).slice(0, 400)
      text = stringifyChecked(next)
    }
    if (Object.keys(truncated).length) next._truncated = truncated
    text = stringifyChecked(next)
    if (text.length > MAX_PAYLOAD_CHARS) throw new Error('PAYLOAD_BUDGET_EXCEEDED')
    return { object: next, text: text, truncated: truncated }
  }

  function randomNonce() {
    const bytes = new Uint8Array(16)
    if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes)
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
    return Array.from(bytes, function (b) {
      return b.toString(16).padStart(2, '0')
    }).join('')
  }

  function wrapUntrusted(payloadText, nonce) {
    return `<UNTRUSTED_PAGE_DATA nonce="${nonce}">\n${payloadText}\n</UNTRUSTED_PAGE_DATA nonce="${nonce}">`
  }

  function buildAnalyzePayload(product, fields) {
    if (hasProductBundle(product)) {
      return Object.assign({ mode: 'product' }, enforceBudget(productPayload(product, fields)))
    }
    if (fields) {
      const compact = compactFields(fields)
      return Object.assign({ mode: 'legacy' }, enforceBudget(compact))
    }
    throw new Error('NO_PRODUCT_OR_FIELDS')
  }

  ns.bg.payloadBuilder = {
    stripImageNames,
    cleanEvidenceRows,
    sanitizeModelEvidence,
    compactFields,
    stringifyChecked,
    enforceBudget,
    randomNonce,
    wrapUntrusted,
    buildAnalyzePayload,
    hasProductBundle,
    MAX_PAYLOAD_CHARS,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
