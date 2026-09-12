;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const PROFILES = ['FULL', 'COMPACT', 'MINIMAL']
  const PAYLOAD_BUDGET_MESSAGE =
    '商品信息过长，已自动压缩但仍超过当前模型输入预算。请切换支持更长上下文的模型或减少分析内容。'

  const CORE_PRODUCT_KEYS = ['name', 'category', 'model', 'sku', 'material', 'power', 'voltage', 'capacity', 'moq']
  const CORE_SPEC_RE =
    /^(?:name|category|model|sku|material|power|voltage|capacity|moq|功率|电压|容量|材质|型号|品名|起订)$/i
  const DEBUG_KEYS = {
    _truncated: true,
    debug: true,
    _debug: true,
    collectGaps: true,
    selectorHits: true,
    qualityScore: true,
    finalQualityScore: true,
    productRootFound: true,
    oldFieldCount: true,
    newFieldCount: true,
    sampleCount: true,
    observerTriggeredCount: true,
    readDurationMs: true,
    completeProduct: true,
    degraded: true,
    site: true,
    imageCandidates: true,
    frameCount: true,
    imageRank: true,
  }
  const COMPANY_CORE_KEYS = { name: true }

  const LIMITS = {
    FULL: {
      companyProfileParagraphs: Infinity,
      companyProfileChars: Infinity,
      descriptionParagraphs: Infinity,
      descriptionChars: Infinity,
      specs: Infinity,
      attributes: Infinity,
      keywords: Infinity,
      applications: Infinity,
      certifications: Infinity,
      formFields: Infinity,
      images: 5,
      fallbackParagraphs: Infinity,
      fallbackChars: Infinity,
      dropDebug: false,
      dropCompanyNonCore: false,
    },
    COMPACT: {
      companyProfileParagraphs: 2,
      companyProfileChars: 400,
      descriptionParagraphs: 6,
      descriptionChars: 1800,
      specs: 16,
      attributes: 8,
      keywords: 12,
      applications: 6,
      certifications: 6,
      formFields: 16,
      images: 2,
      fallbackParagraphs: 4,
      fallbackChars: 2000,
      dropDebug: true,
      dropCompanyNonCore: true,
    },
    MINIMAL: {
      companyProfileParagraphs: 0,
      companyProfileChars: 0,
      descriptionParagraphs: 2,
      descriptionChars: 600,
      specs: 8,
      attributes: 4,
      keywords: 8,
      applications: 3,
      certifications: 3,
      formFields: 8,
      images: 1,
      fallbackParagraphs: 0,
      fallbackChars: 0,
      dropDebug: true,
      dropCompanyNonCore: true,
    },
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value == null ? {} : value))
  }

  function unicodeSlice(text, max) {
    if (max === Infinity) return String(text || '')
    return Array.from(String(text || '')).slice(0, Math.max(0, max)).join('')
  }

  function splitParagraphs(text) {
    const raw = String(text || '').trim()
    if (!raw) return []
    const blocks = raw.split(/\n\s*\n+/).map(function (part) { return part.trim() }).filter(Boolean)
    if (blocks.length > 1) return blocks
    const lines = raw.split(/\n+/).map(function (part) { return part.trim() }).filter(Boolean)
    if (lines.length > 1) return lines
    const sentences = raw.split(/(?<=[。！？.!?])\s+/).map(function (part) { return part.trim() }).filter(Boolean)
    return sentences.length ? sentences : [raw]
  }

  function clipParagraphs(text, maxParas, maxChars) {
    if (text == null) return text
    if (maxParas === Infinity && maxChars === Infinity) return String(text)
    if (maxParas <= 0 || maxChars <= 0) return ''
    const paras = splitParagraphs(text)
    const kept = []
    let used = 0
    for (let i = 0; i < paras.length && kept.length < maxParas; i += 1) {
      let part = paras[i]
      if (used + part.length > maxChars) {
        const remain = maxChars - used
        if (remain > 0) kept.push(unicodeSlice(part, remain))
        break
      }
      kept.push(part)
      used += part.length
    }
    return kept.join('\n\n')
  }

  function specName(item) {
    if (!item || typeof item !== 'object') return ''
    return String(item.name || item.field || item.label || item.key || '').trim()
  }

  function specValue(item) {
    if (item == null) return ''
    if (typeof item !== 'object') return String(item)
    return String(item.value != null ? item.value : item.text != null ? item.text : '')
  }

  function isVerifiedFact(item) {
    if (!item || typeof item !== 'object') return false
    const status = String(item.status || item.verification || '').toUpperCase()
    if (status === 'VERIFIED') return true
    if (item.verified === true) return true
    const confidence = Number(item.confidence)
    return !isNaN(confidence) && confidence >= 80
  }

  function isCoreSpec(item) {
    const name = specName(item)
    if (!name) return false
    if (CORE_SPEC_RE.test(name)) return true
    const compact = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
    return CORE_SPEC_RE.test(compact)
  }

  function uniqueStrings(values, limit) {
    const seen = Object.create(null)
    const out = []
    ;(values || []).forEach(function (value) {
      const text = String(value == null ? '' : value).trim()
      if (!text) return
      const key = text.toLowerCase()
      if (seen[key]) return
      seen[key] = true
      out.push(typeof value === 'string' ? text : value)
    })
    if (limit === Infinity) return out
    return out.slice(0, Math.max(0, limit))
  }

  function dedupeSpecs(rows) {
    const seen = Object.create(null)
    const out = []
    ;(rows || []).forEach(function (item, index) {
      const key = typeof item === 'string' ? item.toLowerCase() : specName(item).toLowerCase() + '\u0000' + specValue(item).toLowerCase()
      if (!key.replace(/\u0000/g, '')) return
      if (seen[key]) return
      seen[key] = true
      out.push(item)
    })
    return out
  }

  function rankSpecs(rows) {
    return dedupeSpecs(rows).map(function (item, index) {
      return {
        item: item,
        index: index,
        core: isCoreSpec(item) ? 1 : 0,
        verified: isVerifiedFact(item) ? 1 : 0,
        valueLen: specValue(item).length,
      }
    }).sort(function (a, b) {
      if (b.core !== a.core) return b.core - a.core
      if (b.verified !== a.verified) return b.verified - a.verified
      if (b.valueLen !== a.valueLen) return b.valueLen - a.valueLen
      return a.index - b.index
    })
  }

  function limitSpecs(rows, limit) {
    const ranked = rankSpecs(rows)
    if (limit === Infinity) return ranked.map(function (row) { return row.item })
    const must = []
    const rest = []
    ranked.forEach(function (row) {
      if (row.core || row.verified) must.push(row.item)
      else rest.push(row.item)
    })
    const room = Math.max(0, limit - must.length)
    return must.concat(rest.slice(0, room))
  }

  function dropDebug(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
    Object.keys(obj).forEach(function (key) {
      if (DEBUG_KEYS[key]) delete obj[key]
    })
    return obj
  }

  function limitCompany(company, limits) {
    if (!company || typeof company !== 'object') return company
    const next = limits.dropCompanyNonCore ? { name: company.name || null } : cloneJson(company)
    if (limits.companyProfileChars <= 0) next.profile = null
    else if (company.profile != null) {
      next.profile = clipParagraphs(company.profile, limits.companyProfileParagraphs, limits.companyProfileChars)
    }
    return next
  }

  function bump(counts, key, amount) {
    if (!amount) return
    counts[key] = (counts[key] || 0) + amount
  }

  function applyProfile(payload, profileName, options) {
    const profile = PROFILES.indexOf(profileName) >= 0 ? profileName : 'FULL'
    const limits = LIMITS[profile]
    const next = cloneJson(payload)
    const imagesIn = Array.isArray(options && options.images) ? options.images.slice() : []
    const removedSections = []
    const removedCounts = {}
    const images = imagesIn.slice(0, limits.images === Infinity ? imagesIn.length : limits.images)
    if (profile === 'FULL') {
      if (imagesIn.length > images.length) {
        removedSections.push('images')
        bump(removedCounts, 'images', imagesIn.length - images.length)
      }
      return {
        profile: profile,
        object: next,
        images: images,
        removedSections: removedSections,
        removedCounts: removedCounts,
      }
    }

    if (limits.dropDebug) {
      const beforeKeys = Object.keys(next)
      dropDebug(next)
      if (next.product && typeof next.product === 'object') dropDebug(next.product)
      if (next.company && typeof next.company === 'object') dropDebug(next.company)
      if (next.current && typeof next.current === 'object') dropDebug(next.current)
      const dropped = beforeKeys.filter(function (key) { return DEBUG_KEYS[key] && next[key] == null })
      if (dropped.length) {
        removedSections.push('debug')
        bump(removedCounts, 'debug', dropped.length)
      }
    }

    if (next.product && typeof next.product === 'object') {
      const product = next.product
      const specBefore = (product.specifications || []).length
      const attrBefore = (product.attributes || []).length
      const kwBefore = (product.keywords || []).length
      const appBefore = (product.applications || []).length
      const certBefore = (product.certifications || []).length
      product.keywords = uniqueStrings(product.keywords, Infinity)
      product.applications = uniqueStrings(product.applications, Infinity)
      product.certifications = uniqueStrings(product.certifications, Infinity)
      product.specifications = dedupeSpecs(product.specifications)
      product.attributes = dedupeSpecs(product.attributes)
      bump(removedCounts, 'duplicateKeywords', kwBefore - product.keywords.length)
      bump(removedCounts, 'duplicateSpecs', specBefore - product.specifications.length)
      bump(removedCounts, 'duplicateAttributes', attrBefore - product.attributes.length)
      if (
        kwBefore !== product.keywords.length ||
        specBefore !== product.specifications.length ||
        attrBefore !== product.attributes.length
      ) {
        removedSections.push('duplicates')
      }

      if (next.company) {
        const companyBefore = next.company && typeof next.company === 'object' ? Object.keys(next.company).length : 0
        next.company = limitCompany(next.company, limits)
        const companyAfter = next.company && typeof next.company === 'object' ? Object.keys(next.company).filter(function (key) {
          return next.company[key] != null && next.company[key] !== ''
        }).length : 0
        if (limits.dropCompanyNonCore && companyBefore > companyAfter) {
          removedSections.push('company')
          bump(removedCounts, 'companyFields', companyBefore - companyAfter)
        }
        if (limits.companyProfileChars !== Infinity) {
          removedSections.push('company.profile')
          bump(removedCounts, 'companyProfile', 1)
        }
      }

      if (product.description != null && limits.descriptionChars !== Infinity) {
        product.description = clipParagraphs(product.description, limits.descriptionParagraphs, limits.descriptionChars)
        removedSections.push('description')
        bump(removedCounts, 'description', 1)
      }

      product.specifications = limitSpecs(product.specifications, limits.specs)
      product.attributes = limitSpecs(product.attributes, limits.attributes)
      if (specBefore > product.specifications.length) {
        removedSections.push('specifications')
        bump(removedCounts, 'specifications', specBefore - product.specifications.length)
      }
      if (attrBefore > product.attributes.length) {
        removedSections.push('attributes')
        bump(removedCounts, 'attributes', attrBefore - product.attributes.length)
      }

      product.keywords = uniqueStrings(product.keywords, limits.keywords)
      if (kwBefore > product.keywords.length) {
        removedSections.push('keywords')
        bump(removedCounts, 'keywords', kwBefore - product.keywords.length)
      }

      product.applications = uniqueStrings(product.applications, limits.applications)
      product.certifications = uniqueStrings(product.certifications, limits.certifications)
      if (appBefore > product.applications.length) {
        removedSections.push('applications')
        bump(removedCounts, 'applications', appBefore - product.applications.length)
      }
      if (certBefore > product.certifications.length) {
        removedSections.push('certifications')
        bump(removedCounts, 'certifications', certBefore - product.certifications.length)
      }
    } else {
      if (Array.isArray(next.keywords)) {
        const kwBefore = next.keywords.length
        next.keywords = uniqueStrings(next.keywords, limits.keywords)
        if (kwBefore > next.keywords.length) {
          removedSections.push('keywords')
          bump(removedCounts, 'keywords', kwBefore - next.keywords.length)
        }
      }
      if (Array.isArray(next.specs)) {
        const specBefore = next.specs.length
        next.specs = limitSpecs(next.specs, limits.specs)
        if (specBefore > next.specs.length) {
          removedSections.push('specifications')
          bump(removedCounts, 'specifications', specBefore - next.specs.length)
        }
      }
      if (Array.isArray(next.formFields)) {
        const formBefore = next.formFields.length
        next.formFields = uniqueStrings(next.formFields, limits.formFields)
        if (formBefore > next.formFields.length) {
          removedSections.push('formFields')
          bump(removedCounts, 'formFields', formBefore - next.formFields.length)
        }
      }
      if (Array.isArray(next.certifications)) {
        const certBefore = next.certifications.length
        next.certifications = uniqueStrings(next.certifications, limits.certifications)
        if (certBefore > next.certifications.length) {
          removedSections.push('certifications')
          bump(removedCounts, 'certifications', certBefore - next.certifications.length)
        }
      }
      if (next.companyProfile != null && limits.companyProfileChars !== Infinity) {
        next.companyProfile = clipParagraphs(next.companyProfile, limits.companyProfileParagraphs, limits.companyProfileChars)
        removedSections.push('company.profile')
        bump(removedCounts, 'companyProfile', 1)
      }
      if (next.description != null && limits.descriptionChars !== Infinity) {
        next.description = clipParagraphs(next.description, limits.descriptionParagraphs, limits.descriptionChars)
        removedSections.push('description')
        bump(removedCounts, 'description', 1)
      }
    }

    if (next.current && typeof next.current === 'object') {
      const kwBefore = Array.isArray(next.current.keywords) ? next.current.keywords.length : 0
      next.current.keywords = uniqueStrings(next.current.keywords, Infinity)
      if (kwBefore > next.current.keywords.length) {
        removedSections.push('current.keywords')
        bump(removedCounts, 'currentKeywords', kwBefore - next.current.keywords.length)
      }
      if (next.current.description != null && limits.descriptionChars !== Infinity) {
        next.current.description = clipParagraphs(
          next.current.description,
          limits.descriptionParagraphs,
          limits.descriptionChars,
        )
      }
    }

    if (imagesIn.length > images.length) {
      removedSections.push('images')
      bump(removedCounts, 'images', imagesIn.length - images.length)
    }

    if (next.fallbackText != null && limits.fallbackChars !== Infinity) {
      next.fallbackText = clipParagraphs(next.fallbackText, limits.fallbackParagraphs, limits.fallbackChars)
      removedSections.push('fallbackText')
      bump(removedCounts, 'fallbackText', 1)
    }
    if (next.visibleText != null && limits.fallbackChars !== Infinity) {
      next.visibleText = clipParagraphs(next.visibleText, limits.fallbackParagraphs, limits.fallbackChars)
      removedSections.push('visibleText')
      bump(removedCounts, 'visibleText', 1)
    }

    return {
      profile: profile,
      object: next,
      images: images,
      removedSections: uniqueStrings(removedSections, Infinity),
      removedCounts: removedCounts,
    }
  }

  function stringifyChecked(obj) {
    const text = JSON.stringify(obj)
    JSON.parse(text)
    return text
  }

  function estimateTokens(obj, images) {
    const text = JSON.stringify(obj == null ? {} : obj)
    const textTokens = Math.max(1, Math.ceil(text.length / 4))
    const imageTokens = (images || []).length * 765
    return {
      chars: text.length,
      tokens: textTokens + imageTokens,
      textTokens: textTokens,
      imageTokens: imageTokens,
    }
  }

  function publicDebug(profile, originalEst, finalEst, removedSections, removedCounts, imageBefore, imageAfter) {
    return {
      payloadProfile: profile,
      originalEstimatedTokens: originalEst.tokens,
      finalEstimatedTokens: finalEst.tokens,
      removedSections: (removedSections || []).slice(),
      removedCounts: Object.assign({}, removedCounts || {}),
      imageCountBefore: imageBefore,
      imageCountAfter: imageAfter,
    }
  }

  function withinBudget(obj, maxChars) {
    return stringifyChecked(obj).length <= maxChars
  }

  function fitToBudget(payload, options) {
    const opts = options || {}
    const maxChars = opts.maxChars != null ? Number(opts.maxChars) : 28000
    const imagesIn = Array.isArray(opts.images) ? opts.images.slice() : []
    const original = cloneJson(payload)
    const full = applyProfile(original, 'FULL', { images: imagesIn })
    const originalEst = estimateTokens(full.object, full.images)
    const imageBefore = imagesIn.length

    function pack(applied, overBudget) {
      const text = stringifyChecked(applied.object)
      const finalEst = estimateTokens(applied.object, applied.images)
      return {
        overBudget: !!overBudget,
        profile: applied.profile,
        object: applied.object,
        text: text,
        images: applied.images,
        debug: publicDebug(
          applied.profile,
          originalEst,
          finalEst,
          applied.removedSections,
          applied.removedCounts,
          imageBefore,
          applied.images.length,
        ),
      }
    }

    if (withinBudget(full.object, maxChars)) return pack(full, false)

    const compact = applyProfile(original, 'COMPACT', { images: imagesIn })
    if (withinBudget(compact.object, maxChars)) return pack(compact, false)

    const minimal = applyProfile(original, 'MINIMAL', { images: imagesIn })
    if (withinBudget(minimal.object, maxChars)) return pack(minimal, false)

    return pack(minimal, true)
  }

  function createBudgetError(debug) {
    const error = new Error(PAYLOAD_BUDGET_MESSAGE)
    error.code = 'PAYLOAD_BUDGET_EXCEEDED'
    error.payloadDebug = debug || null
    return error
  }

  ns.payloadCompactor = {
    PROFILES: PROFILES,
    LIMITS: LIMITS,
    CORE_PRODUCT_KEYS: CORE_PRODUCT_KEYS,
    PAYLOAD_BUDGET_MESSAGE: PAYLOAD_BUDGET_MESSAGE,
    cloneJson: cloneJson,
    unicodeSlice: unicodeSlice,
    splitParagraphs: splitParagraphs,
    clipParagraphs: clipParagraphs,
    isVerifiedFact: isVerifiedFact,
    isCoreSpec: isCoreSpec,
    applyProfile: applyProfile,
    estimateTokens: estimateTokens,
    fitToBudget: fitToBudget,
    createBudgetError: createBudgetError,
    stringifyChecked: stringifyChecked,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
