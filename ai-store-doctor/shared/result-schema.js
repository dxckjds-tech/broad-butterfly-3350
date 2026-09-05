;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const FACT_STATUS = { VERIFIED: true, OBSERVED: true, INFERRED: true, UNKNOWN: true }
  const SUMMARY_STATUS = { VERIFIED: true, BLOCKED: true, UNKNOWN: true }

  function toScore(value) {
    if (value == null || value === '') return 0
    let n = Number(value)
    if (!Number.isFinite(n)) return 0
    if (n > 0 && n <= 1) n = n * 100
    return Math.max(0, Math.min(100, Math.round(n)))
  }

  function asArray(value) {
    if (Array.isArray(value)) return value
    if (value == null) return []
    if (typeof value === 'object') return Object.keys(value).map(function (key) {
      return value[key]
    })
    return []
  }

  function asString(value) {
    if (value == null) return ''
    return String(value)
  }

  function normFactStatus(value, repaired) {
    const raw = asString(value).trim()
    const up = raw.toUpperCase()
    if (FACT_STATUS[up]) {
      if (raw && raw !== up) repaired.push('status-case:' + raw)
      return up
    }
    repaired.push('status:' + (raw || 'empty') + '->UNKNOWN')
    return 'UNKNOWN'
  }

  function emptyDetail() {
    return {
      headline: '',
      overview: '',
      highlights: [],
      specifications: [],
      applications: [],
      packagingDelivery: '',
      buyerNote: '',
    }
  }

  function emptyGeo() {
    return {
      headline: '',
      directAnswer: '',
      productFacts: [],
      companyContext: '',
      buyerQuestions: [],
      sourcingGuidance: [],
      evidenceBasis: [],
    }
  }

  function extractJson(raw) {
    if (raw && typeof raw === 'object') return { ok: true, value: raw }
    const text = String(raw || '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    try {
      return { ok: true, value: JSON.parse(text) }
    } catch (e) {
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start >= 0 && end > start) {
        try {
          return { ok: true, value: JSON.parse(text.slice(start, end + 1)) }
        } catch (err) {
          return { ok: false, error: 'JSON_PARSE' }
        }
      }
      return { ok: false, error: 'JSON_PARSE' }
    }
  }

  function normalizeAndValidate(raw) {
    const repaired = []
    const errors = []
    const extracted = extractJson(raw)
    if (!extracted.ok) return { ok: false, fatal: true, errors: ['JSON_PARSE'], repaired: repaired, result: null }

    const src = extracted.value
    if (!src || typeof src !== 'object' || Array.isArray(src)) {
      return { ok: false, fatal: true, errors: ['NOT_OBJECT'], repaired: repaired, result: null }
    }
    if (!src.summary || typeof src.summary !== 'object' || Array.isArray(src.summary)) {
      return { ok: false, fatal: true, errors: ['MISSING_SUMMARY'], repaired: repaired, result: null }
    }

    const summary = src.summary
    const statusRaw = asString(summary.status).trim().toUpperCase()
    const summaryStatus = SUMMARY_STATUS[statusRaw] ? statusRaw : 'UNKNOWN'
    if (!SUMMARY_STATUS[statusRaw]) repaired.push('summary.status->UNKNOWN')

    const result = {
      summary: {
        identity: asString(summary.identity),
        confidence: toScore(summary.confidence),
        dataCompleteness: toScore(summary.dataCompleteness),
        contentReadiness: toScore(summary.contentReadiness),
        status: summaryStatus,
        conflicts: asArray(summary.conflicts).map(asString),
        nextActions: asArray(summary.nextActions).map(asString),
      },
      identityCandidates: asArray(src.identityCandidates)
        .filter(function (item) {
          return item && typeof item === 'object'
        })
        .map(function (item) {
          return {
            name: asString(item.name),
            confidence: toScore(item.confidence),
            support: asArray(item.support).map(asString),
            oppose: asArray(item.oppose).map(asString),
          }
        }),
      facts: asArray(src.facts)
        .filter(function (item) {
          return item && typeof item === 'object'
        })
        .map(function (item) {
          return {
            label: asString(item.label),
            value: asString(item.value),
            status: normFactStatus(item.status, repaired),
            source: asString(item.source),
            note: asString(item.note),
          }
        }),
      keywords: normalizeKeywords(src.keywords, repaired),
      content: normalizeContent(src.content, repaired),
      debug: normalizeDebug(src.debug),
    }

    if (!Array.isArray(src.facts)) repaired.push('facts-not-array')
    if (src.identityCandidates == null) repaired.push('identityCandidates-null')

    result.debug.repaired = (result.debug.repaired || []).concat(repaired)
    return { ok: true, fatal: false, errors: errors, repaired: repaired, result: result }
  }

  function normalizeKeywords(raw, repaired) {
    const empty = { current: [], blocked: [], candidates: [] }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      repaired.push('keywords-format')
      return empty
    }
    return {
      current: asArray(raw.current).map(asString),
      blocked: asArray(raw.blocked)
        .filter(function (item) {
          return item && typeof item === 'object'
        })
        .map(function (item) {
          return { keyword: asString(item.keyword), reason: asString(item.reason) }
        }),
      candidates: asArray(raw.candidates)
        .filter(function (item) {
          return item && typeof item === 'object'
        })
        .map(function (item) {
          return {
            keyword: asString(item.keyword),
            matchScore: toScore(item.matchScore),
            intent: asString(item.intent),
            basis: asString(item.basis),
          }
        }),
    }
  }

  function normalizeContent(raw, repaired) {
    const content = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) repaired.push('content-format')
    let detail = emptyDetail()
    if (typeof content.detail === 'string') {
      detail.overview = content.detail
      repaired.push('content.detail-string')
    } else if (content.detail && typeof content.detail === 'object') {
      detail = Object.assign(emptyDetail(), {
        headline: asString(content.detail.headline),
        overview: asString(content.detail.overview),
        highlights: asArray(content.detail.highlights).map(asString),
        specifications: asArray(content.detail.specifications)
          .filter(function (item) {
            return item && typeof item === 'object'
          })
          .map(function (item) {
            return { name: asString(item.name), value: asString(item.value) }
          }),
        applications: asArray(content.detail.applications).map(asString),
        packagingDelivery: asString(content.detail.packagingDelivery),
        buyerNote: asString(content.detail.buyerNote),
      })
    }
    let geo = emptyGeo()
    if (Array.isArray(content.geo)) {
      repaired.push('content.geo-array')
      const first = content.geo.find(function (item) {
        return item && typeof item === 'object'
      })
      if (first) geo = Object.assign(emptyGeo(), normalizeGeo(first))
    } else if (content.geo && typeof content.geo === 'object') {
      geo = Object.assign(emptyGeo(), normalizeGeo(content.geo))
    }
    return {
      titles: asArray(content.titles)
        .filter(function (item) {
          return item && typeof item === 'object'
        })
        .map(function (item) {
          return {
            text: asString(item.text),
            style: asString(item.style),
            factsUsed: asArray(item.factsUsed).map(asString),
            excluded: asArray(item.excluded).map(asString),
          }
        }),
      detail: detail,
      faq: asArray(content.faq)
        .filter(function (item) {
          return item && typeof item === 'object'
        })
        .map(function (item) {
          return { question: asString(item.question), answer: asString(item.answer) }
        }),
      geo: geo,
    }
  }

  function normalizeGeo(raw) {
    return {
      headline: asString(raw.headline),
      directAnswer: asString(raw.directAnswer),
      productFacts: asArray(raw.productFacts).map(asString),
      companyContext: asString(raw.companyContext),
      buyerQuestions: asArray(raw.buyerQuestions)
        .filter(function (item) {
          return item && typeof item === 'object'
        })
        .map(function (item) {
          return { question: asString(item.question), answer: asString(item.answer) }
        }),
      sourcingGuidance: asArray(raw.sourcingGuidance).map(asString),
      evidenceBasis: asArray(raw.evidenceBasis).map(asString),
    }
  }

  function normalizeDebug(raw) {
    const debug = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    return {
      missingFields: asArray(debug.missingFields).map(asString),
      warnings: asArray(debug.warnings).map(asString),
      repaired: asArray(debug.repaired).map(asString),
    }
  }

  ns.schema = { normalizeAndValidate, extractJson, toScore }
})(typeof globalThis !== 'undefined' ? globalThis : self)
