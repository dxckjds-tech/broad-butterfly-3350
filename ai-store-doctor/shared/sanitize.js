;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const LABELS = {
    email: '[REDACTED_EMAIL]',
    phone: '[REDACTED_PHONE]',
    secret: '[REDACTED_SECRET]',
    id: '[REDACTED_ID]',
    card: '[REDACTED_CARD]',
  }

  function emptyCounts() {
    return { email: 0, phone: 0, secret: 0, id: 0, card: 0, total: 0 }
  }

  function looksLikeSpecToken(text, match, index) {
    const before = text.slice(Math.max(0, index - 8), index)
    const after = text.slice(index + match.length, index + match.length + 8)
    const around = (before + match + after).replace(/\s+/g, '')
    if (/(?:SKU|MT-|MODEL)[A-Z0-9\-]*$/i.test(before + match)) return true
    if (/^\d+(?:\.\d+)?(?:V|W|L|A|Hz|kW|mA)\b/i.test(match + after)) return true
    if (/^\d+\s*[-~/]\s*\d+\s*(?:V|W|Hz)/i.test(match + after)) return true
    if (/\d+\/\d+Hz/i.test(around)) return true
    return false
  }

  function replaceType(text, type, counts) {
    const source = ns.piiPatterns[type]
    if (!source) return text
    const re = new RegExp(source.source, source.flags)
    return text.replace(re, function (match, offset) {
      if (looksLikeSpecToken(text, match, offset)) return match
      counts[type] += 1
      counts.total += 1
      return LABELS[type]
    })
  }

  function sanitizeString(text, counts) {
    if (typeof text !== 'string' || !text) return text
    let next = text
    next = replaceType(next, 'email', counts)
    next = replaceType(next, 'secret', counts)
    next = replaceType(next, 'id', counts)
    next = replaceType(next, 'card', counts)
    next = replaceType(next, 'phone', counts)
    return next
  }

  function walk(value, counts) {
    if (typeof value === 'string') return sanitizeString(value, counts)
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return walk(item, counts)
      })
    }
    if (value && typeof value === 'object') {
      const out = Array.isArray(value) ? [] : {}
      Object.keys(value).forEach(function (key) {
        if (key === 'debug' || key === 'redacted' || key === 'injectionHits') {
          out[key] = value[key]
          return
        }
        out[key] = walk(value[key], counts)
      })
      return out
    }
    return value
  }

  function scanInjection(text) {
    const hits = {}
    let total = 0
    const source = String(text || '')
    ;(ns.piiPatterns.injection || []).forEach(function (item) {
      if (item.re.test(source)) {
        hits[item.type] = (hits[item.type] || 0) + 1
        total += 1
      }
    })
    return { hits: hits, total: total }
  }

  function scanInjectionDeep(value, acc) {
    acc = acc || { hits: {}, total: 0 }
    if (typeof value === 'string') {
      const found = scanInjection(value)
      Object.keys(found.hits).forEach(function (type) {
        acc.hits[type] = (acc.hits[type] || 0) + found.hits[type]
        acc.total += found.hits[type]
      })
      return acc
    }
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        scanInjectionDeep(item, acc)
      })
      return acc
    }
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (key) {
        if (key !== 'debug') scanInjectionDeep(value[key], acc)
      })
    }
    return acc
  }

  function attachDebug(target, counts, injection) {
    if (!target || typeof target !== 'object') return target
    target.debug = target.debug || {}
    target.debug.redacted = {
      email: counts.email,
      phone: counts.phone,
      secret: counts.secret,
      id: counts.id,
      card: counts.card,
      total: counts.total,
    }
    target.debug.injectionHits = { total: injection.total, types: injection.hits }
    return target
  }

  function sanitizeCollected(payload) {
    const counts = emptyCounts()
    const next = walk(payload, counts)
    const injection = scanInjectionDeep(payload)
    if (next && next.product) attachDebug(next.product, counts, injection)
    else if (next && next.debug) attachDebug(next, counts, injection)
    return next
  }

  function sanitizePayload(payload) {
    const counts = emptyCounts()
    const next = walk(payload, counts)
    if (next && typeof next === 'object' && !Array.isArray(next)) {
      attachDebug(next, counts, scanInjectionDeep(payload))
    }
    return next
  }

  ns.sanitize = {
    sanitizeString,
    sanitizeCollected,
    sanitizePayload,
    scanInjection,
    emptyCounts,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
