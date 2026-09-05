;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const TRUSTED = { product_field: true, spec_table: true, json_ld: true, explicit_page_field: true }

  function asString(value) {
    return value == null ? '' : String(value)
  }

  function rejectedValues(list) {
    return (list || [])
      .map(function (item) {
        return asString(item && (item.value || item.label || item)).toLowerCase()
      })
      .filter(Boolean)
  }

  function containsRejected(text, banned) {
    const raw = asString(text).toLowerCase()
    if (!raw) return false
    return banned.some(function (item) {
      return item && raw.indexOf(item) !== -1
    })
  }

  function scrubText(text, banned) {
    let out = asString(text)
    banned.forEach(function (item) {
      if (!item) return
      const re = new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig')
      out = out.replace(re, '')
    })
    return out.replace(/\s{2,}/g, ' ').trim()
  }

  function scrubList(list, banned) {
    return (Array.isArray(list) ? list : []).filter(function (item) {
      if (item && typeof item === 'object') {
        const blob = asString(item.text || item.value || item.name || JSON.stringify(item))
        return !containsRejected(blob, banned)
      }
      return !containsRejected(item, banned)
    })
  }

  function apply(report, opts) {
    const input = report && typeof report === 'object' ? report : {}
    const options = opts || {}
    const banned = rejectedValues(options.rejectedClaims)
    const repaired = []
    const result = JSON.parse(JSON.stringify(input))
    let downgraded = 0

    result.facts = (result.facts || []).filter(function (fact) {
      if (!fact) return false
      const value = asString(fact.value).toLowerCase()
      if (value && banned.indexOf(value) !== -1) {
        repaired.push('guard-rejected-removed')
        return false
      }
      const status = asString(fact.status).toUpperCase()
      const trusted = !!TRUSTED[String(fact.sourceType || '')]
      if (status === 'VERIFIED' && !trusted) {
        fact.status = String(fact.sourceType || '') === 'vision' ? 'OBSERVED' : 'OBSERVED'
        downgraded += 1
        repaired.push('guard-verified-downgrade')
      }
      return true
    })

    const unknownValues = {}
    result.facts.forEach(function (fact) {
      if (fact && asString(fact.status).toUpperCase() === 'UNKNOWN' && fact.value) {
        unknownValues[asString(fact.value).toLowerCase()] = true
      }
    })

    const content = result.content || (result.content = {})
    if (Array.isArray(content.titles)) {
      content.titles = content.titles.filter(function (row) {
        const text = asString(row && (row.text || row))
        if (containsRejected(text, banned)) return false
        return !Object.keys(unknownValues).some(function (item) {
          return item && text.toLowerCase().indexOf(item) !== -1
        })
      })
    }
    if (content.detail) {
      ;['headline', 'overview', 'packagingDelivery', 'buyerNote'].forEach(function (key) {
        if (containsRejected(content.detail[key], banned)) {
          content.detail[key] = scrubText(content.detail[key], banned)
          repaired.push('guard-scrub-detail')
        }
      })
      content.detail.highlights = scrubList(content.detail.highlights, banned)
      content.detail.applications = scrubList(content.detail.applications, banned)
      content.detail.specifications = (content.detail.specifications || []).filter(function (item) {
        const value = asString(item && item.value).toLowerCase()
        if (containsRejected(item && (item.value || item.name), banned)) return false
        if (value && unknownValues[value]) {
          repaired.push('guard-unknown-spec-removed')
          return false
        }
        return true
      })
    }
    if (Array.isArray(content.faq)) {
      content.faq = content.faq.filter(function (item) {
        return !containsRejected(JSON.stringify(item || {}), banned)
      })
    }
    if (content.geo) {
      ;['headline', 'directAnswer', 'companyContext'].forEach(function (key) {
        if (containsRejected(content.geo[key], banned)) {
          content.geo[key] = scrubText(content.geo[key], banned)
          repaired.push('guard-scrub-geo')
        }
      })
      ;['productFacts', 'buyerQuestions', 'sourcingGuidance', 'evidenceBasis'].forEach(function (key) {
        content.geo[key] = scrubList(content.geo[key], banned)
      })
    }

    result.debug = result.debug || {}
    result.debug.guardRepaired = (result.debug.guardRepaired || []).concat(repaired)
    return {
      result: result,
      repaired: repaired,
      downgraded: downgraded,
    }
  }

  ns.bg.finalReportGuard = { apply: apply, TRUSTED: TRUSTED }
})(typeof globalThis !== 'undefined' ? globalThis : self)
