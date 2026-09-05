;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const SCORE_VERSION = '1.0'

  function filled(value) {
    if (Array.isArray(value)) return value.length > 0
    return value != null && String(value).trim() !== ''
  }

  function textOf(value) {
    return value == null ? '' : String(value).trim()
  }

  function productOf(bundle) {
    return (bundle && bundle.product) || {}
  }

  function currentOf(bundle) {
    return (bundle && bundle.current) || {}
  }

  function companyOf(bundle) {
    return (bundle && bundle.company) || {}
  }

  function levelOf(total) {
    if (total >= 90) return { level: 'EXCELLENT', label: '优秀' }
    if (total >= 75) return { level: 'GOOD', label: '良好' }
    if (total >= 60) return { level: 'NEEDS_IMPROVEMENT', label: '待优化' }
    if (total >= 40) return { level: 'POOR', label: '较差' }
    return { level: 'CRITICAL', label: '严重问题' }
  }

  function hasUnsupportedSignal(report) {
    const bags = []
    if (report && report.debug) bags.push.apply(bags, report.debug.warnings || [])
    if (report && report.summary) bags.push.apply(bags, report.summary.conflicts || [])
    return bags.some(function (item) {
      return /无证据|营销|unsupported|缺乏证据|编造/i.test(String(item))
    })
  }

  function verifiedFacts(report) {
    return ((report && report.facts) || []).filter(function (fact) {
      return fact && fact.status === 'VERIFIED'
    })
  }

  function blockedKeywords(report) {
    const blocked = report && report.keywords && report.keywords.blocked
    return Array.isArray(blocked) ? blocked : []
  }

  function titleHasIdentity(title, product, report) {
    const hay = title.toLowerCase()
    const identity = textOf(report && report.summary && report.summary.identity)
    const name = textOf(product.name)
    const tokens = (name || identity)
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fff]+/)
      .filter(function (tok) {
        return tok.length >= 3
      })
    if (!tokens.length) return filled(title) && (filled(name) || filled(identity))
    return tokens.some(function (tok) {
      return hay.indexOf(tok) !== -1
    })
  }

  function titleHasSpec(title, product) {
    const hay = title.toLowerCase()
    const specs = [product.model, product.sku, product.material, product.size, product.power, product.voltage, product.capacity]
    if (
      specs.some(function (item) {
        return filled(item) && hay.indexOf(String(item).toLowerCase()) !== -1
      })
    )
      return true
    return /\b(?:dn\s*)?\d+(?:\.\d+)?\s*(?:mm|cm|m|l|w|v|kw|hz|inch|in|kg)\b|\bdn\d+\b/i.test(title)
  }

  function titleIsStuffed(title) {
    const tokens = title.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).filter(Boolean)
    if (tokens.length > 18) return true
    const counts = {}
    tokens.forEach(function (tok) {
      if (tok.length < 3) return
      counts[tok] = (counts[tok] || 0) + 1
    })
    return Object.keys(counts).some(function (tok) {
      return counts[tok] >= 3
    })
  }

  function keywordsMatchIdentity(words, product, report) {
    const identity = (textOf(product.name) + ' ' + textOf(report && report.summary && report.summary.identity)).toLowerCase()
    if (!identity.trim()) return false
    return words.some(function (word) {
      const token = String(word).toLowerCase()
      return token.length >= 3 && identity.indexOf(token) !== -1
    })
  }

  function keywordsCoverSpec(words, product) {
    const pool = [product.model, product.sku, product.material, product.capacity, product.power, product.size]
      .filter(filled)
      .map(function (item) {
        return String(item).toLowerCase()
      })
    const apps = (product.applications || []).map(function (item) {
      return String(item).toLowerCase()
    })
    const joined = words.join(' ').toLowerCase()
    return pool.concat(apps).some(function (item) {
      return item && joined.indexOf(item) !== -1
    })
  }

  function completeness(product) {
    let score = 0
    const issues = []
    const recs = []
    if (filled(product.name)) score += 2
    else {
      issues.push('缺少商品名称')
      recs.push('补充商品名称')
    }
    if (filled(product.category)) score += 2
    else {
      issues.push('缺少类目')
      recs.push('补充商品类目')
    }
    if (filled(product.model) || filled(product.sku)) score += 2
    else {
      issues.push('缺少型号或 SKU')
      recs.push('补充 Model 或 SKU')
    }
    if (filled(product.brand)) score += 1
    else recs.push('补充品牌')
    if (filled(product.price)) score += 1
    else recs.push('补充价格')
    if (filled(product.moq)) score += 2
    else {
      issues.push('MOQ未填写')
      recs.push('增加MOQ')
    }
    const specCount = (product.specifications || []).length
    if (specCount >= 3) score += 3
    else {
      issues.push('规格参数不足')
      recs.push('补充至少 3 条规格')
    }
    const keySpecs = [product.material, product.power, product.size, product.capacity].filter(filled).length
    if (keySpecs >= 2) score += 2
    else recs.push('补充材质/功率/尺寸/容量等关键规格')
    if (filled(product.applications)) score += 2
    else {
      issues.push('产品详情缺少应用场景')
      recs.push('增加应用场景说明')
    }
    if (filled(product.packaging) || filled(product.deliveryTime)) score += 1
    else recs.push('补充包装或交期')
    if (filled(product.certifications)) score += 2
    else recs.push('补充认证信息')
    return {
      id: 'completeness',
      name: '商品信息完整度',
      score: score,
      maxScore: 20,
      issues: issues,
      recommendations: recs,
      reason: '按标准 product 字段是否齐全计分',
    }
  }

  function titleQuality(bundle, report) {
    const product = productOf(bundle)
    const title = textOf(currentOf(bundle).title) || textOf(product.name)
    let score = 0
    const issues = []
    const recs = []
    if (title) {
      score += 4
      if (title.length >= 16 && title.length <= 120) score += 4
      else {
        issues.push('标题长度不合理')
        recs.push('将标题调整到可识别的产品描述长度')
      }
      if (titleHasIdentity(title, product, report)) score += 4
      else {
        issues.push('标题缺少明确产品身份')
        recs.push('在标题中写明产品身份')
      }
      if (titleHasSpec(title, product)) score += 3
      else {
        issues.push('标题缺少规格词')
        recs.push('在标题中补充型号或规格')
      }
      if (hasUnsupportedSignal(report)) {
        issues.push('标题或诊断指出缺少事实证据的营销描述')
        recs.push('删除缺少事实证据的营销描述')
      } else score += 3
      if (titleIsStuffed(title)) {
        issues.push('标题存在明显关键词堆砌')
        recs.push('减少重复关键词')
      } else score += 2
    } else {
      issues.push('缺少标题')
      recs.push('补充商品标题')
    }
    return {
      id: 'title',
      name: '标题质量',
      score: score,
      maxScore: 20,
      issues: issues,
      recommendations: recs,
      reason: '依据 current.title 与已验证诊断信号',
    }
  }

  function keywordQuality(bundle, report) {
    const product = productOf(bundle)
    const current = currentOf(bundle)
    const words = (current.keywords && current.keywords.length ? current.keywords : product.keywords) || []
    let score = 0
    const issues = []
    const recs = []
    if (words.length) {
      score += 3
      if (words.length >= 2 && words.length <= 12) score += 3
      else recs.push('将关键词数量保持在合理范围')
      if (keywordsMatchIdentity(words, product, report)) score += 4
      else {
        issues.push('关键词与产品身份不一致')
        recs.push('关键词对齐产品身份')
      }
      if (!blockedKeywords(report).length) score += 3
      else {
        issues.push('存在明显不建议使用的关键词')
        recs.push('移除被阻止的关键词')
      }
      if (keywordsCoverSpec(words, product)) score += 2
      else recs.push('补充用途或规格相关关键词')
    } else {
      issues.push('缺少关键词')
      recs.push('补充与产品身份一致的关键词')
    }
    return {
      id: 'keywords',
      name: '关键词质量',
      score: score,
      maxScore: 15,
      issues: issues,
      recommendations: recs,
      reason: '只评价相关度，不使用搜索量或排名',
    }
  }

  function detailQuality(bundle, report) {
    const product = productOf(bundle)
    const desc = textOf(currentOf(bundle).description) || textOf(product.description)
    let score = 0
    const issues = []
    const recs = []
    if (desc) {
      score += 4
      if (desc.length >= 80) score += 3
      else recs.push('补充更完整的产品详情')
    } else {
      issues.push('缺少产品详情')
      recs.push('补充产品详情文本')
    }
    if ((product.specifications || []).length >= 1 || filled(product.material) || filled(product.capacity)) score += 4
    else {
      issues.push('详情缺少规格参数')
      recs.push('在详情中列出规格参数')
    }
    if (filled(product.applications) || /application|used for|适用于|应用/i.test(desc)) score += 3
    else {
      issues.push('产品详情缺少应用场景')
      recs.push('增加应用场景说明')
    }
    if (filled(product.moq) || filled(product.price) || filled(product.packaging) || filled(product.deliveryTime))
      score += 3
    else recs.push('补充买家关心的包装、交期或起订量')
    if (desc && !hasUnsupportedSignal(report)) score += 3
    else if (desc && hasUnsupportedSignal(report)) {
      issues.push('详情含无依据营销描述')
      recs.push('删除无证据的营销句子')
    }
    return {
      id: 'detail',
      name: '商品详情质量',
      score: score,
      maxScore: 20,
      issues: issues,
      recommendations: recs,
      reason: '依据 current.description、规格与已验证诊断',
    }
  }

  function trustQuality(bundle, report) {
    const product = productOf(bundle)
    const company = companyOf(bundle)
    let score = 0
    const issues = []
    const recs = []
    if (filled(product.certifications)) score += 4
    else recs.push('补充可验证的认证信息')
    if (filled(company.name) || filled(company.profile)) score += 3
    else recs.push('补充公司信息')
    if (filled(product.packaging)) score += 2
    else recs.push('补充包装信息')
    if (filled(product.deliveryTime)) score += 2
    else recs.push('补充交期信息')
    if (verifiedFacts(report).length >= 2) score += 2
    else recs.push('用页面证据确认至少 2 条已验证事实')
    if (report && report.summary && Array.isArray(report.summary.conflicts) && report.summary.conflicts.length)
      issues.push('重要信息存在明显矛盾')
    else if (report && report.summary) score += 2
    return {
      id: 'trust',
      name: '买家信任信息',
      score: score,
      maxScore: 15,
      issues: issues,
      recommendations: recs,
      reason: '认证、公司、包装、交期与 VERIFIED 事实',
    }
  }

  function faqGeoQuality(report) {
    const content = (report && report.content) || {}
    const faq = Array.isArray(content.faq) ? content.faq : []
    const geo = content.geo && typeof content.geo === 'object' ? content.geo : null
    let score = 0
    const issues = []
    const recs = []
    if (faq.length) score += 3
    else {
      issues.push('未检测到FAQ')
      recs.push('新增买家高意图 FAQ')
    }
    if (faq.length >= 3) score += 2
    else if (faq.length) recs.push('FAQ 至少覆盖 3 个买家问题')
    const geoHasText = geo && (filled(geo.headline) || filled(geo.directAnswer) || filled(geo.companyContext))
    if (geoHasText) score += 2
    else recs.push('补充 GEO 结构化说明')
    if (geoHasText && !hasUnsupportedSignal(report)) score += 2
    else if (geoHasText) recs.push('移除 GEO 中无证据的表述')
    const structured =
      geo &&
      (Array.isArray(geo.buyerQuestions) ? geo.buyerQuestions.length : 0) +
        (Array.isArray(geo.productFacts) ? geo.productFacts.length : 0) >=
        2
    if (structured) score += 1
    return {
      id: 'faqgeo',
      name: 'FAQ / GEO准备度',
      score: score,
      maxScore: 10,
      issues: issues,
      recommendations: recs,
      reason: '依据已验证 report.content.faq / geo',
    }
  }

  function pickTop(dimensions, key, limit) {
    const rows = []
    dimensions.forEach(function (dim) {
      ;(dim[key] || []).forEach(function (text) {
        rows.push({ text: text, gap: dim.maxScore - dim.score, id: dim.id })
      })
    })
    rows.sort(function (a, b) {
      if (b.gap !== a.gap) return b.gap - a.gap
      if (a.id < b.id) return -1
      if (a.id > b.id) return 1
      if (a.text < b.text) return -1
      if (a.text > b.text) return 1
      return 0
    })
    const seen = {}
    const out = []
    rows.forEach(function (row) {
      if (seen[row.text]) return
      seen[row.text] = true
      out.push(row.text)
    })
    return out.slice(0, limit)
  }

  function compute(bundle, report) {
    const product = productOf(bundle || {})
    const safeReport = report && typeof report === 'object' ? report : {}
    const dimensions = [
      completeness(product),
      titleQuality(bundle || {}, safeReport),
      keywordQuality(bundle || {}, safeReport),
      detailQuality(bundle || {}, safeReport),
      trustQuality(bundle || {}, safeReport),
      faqGeoQuality(safeReport),
    ]
    const total = dimensions.reduce(function (sum, dim) {
      return sum + dim.score
    }, 0)
    const band = levelOf(total)
    return {
      total: total,
      level: band.level,
      label: band.label,
      scoreVersion: SCORE_VERSION,
      dimensions: dimensions,
      topIssues: pickTop(dimensions, 'issues', 3),
      topActions: pickTop(dimensions, 'recommendations', 3),
    }
  }

  ns.healthScore = { compute: compute, SCORE_VERSION: SCORE_VERSION, levelOf: levelOf }
})(typeof globalThis !== 'undefined' ? globalThis : self)
