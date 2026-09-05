;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  function words(text) {
    return String(text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
  }

  function norm(text) {
    return String(text || '').trim()
  }

  function paragraphs(text) {
    return String(text || '')
      .split(/\n\s*\n/)
      .map(function (part) {
        return part.trim()
      })
      .filter(Boolean)
  }

  function lcsBacktrack(a, b) {
    const n = a.length
    const m = b.length
    const dp = []
    for (let i = 0; i <= n; i += 1) {
      dp[i] = []
      for (let j = 0; j <= m; j += 1) dp[i][j] = 0
    }
    for (let i = 1; i <= n; i += 1) {
      for (let j = 1; j <= m; j += 1) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
    const parts = []
    let i = n
    let j = m
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        parts.push({ type: 'same', text: a[i - 1] })
        i -= 1
        j -= 1
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        parts.push({ type: 'removed', text: a[i - 1] })
        i -= 1
      } else {
        parts.push({ type: 'added', text: b[j - 1] })
        j -= 1
      }
    }
    while (i > 0) {
      parts.push({ type: 'removed', text: a[i - 1] })
      i -= 1
    }
    while (j > 0) {
      parts.push({ type: 'added', text: b[j - 1] })
      j -= 1
    }
    parts.reverse()
    return parts
  }

  function titleDiff(current, suggested) {
    const left = words(current)
    const right = words(suggested)
    const parts = left.length || right.length ? lcsBacktrack(left, right) : []
    return {
      current: norm(current),
      suggested: norm(suggested),
      unchanged: norm(current) === norm(suggested),
      added: parts.filter(function (part) { return part.type === 'added' }).map(function (part) { return part.text }),
      removed: parts.filter(function (part) { return part.type === 'removed' }).map(function (part) { return part.text }),
      parts: parts,
    }
  }

  function keywordDiff(current, suggested, blocked) {
    function list(value) {
      if (!Array.isArray(value)) return []
      return value
        .map(function (item) {
          if (item && typeof item === 'object') return String(item.keyword || item.text || '').trim()
          return String(item || '').trim()
        })
        .filter(Boolean)
    }
    const cur = list(current)
    const sug = list(suggested)
    const block = list(blocked)
    const curSet = {}
    const sugSet = {}
    cur.forEach(function (word) { curSet[word.toLowerCase()] = word })
    sug.forEach(function (word) { sugSet[word.toLowerCase()] = word })
    const kept = []
    const added = []
    const removed = []
    Object.keys(curSet).forEach(function (key) {
      if (sugSet[key]) kept.push(curSet[key])
      else removed.push(curSet[key])
    })
    Object.keys(sugSet).forEach(function (key) {
      if (!curSet[key]) added.push(sugSet[key])
    })
    kept.sort()
    added.sort()
    removed.sort()
    return {
      kept: kept,
      added: added,
      removed: removed,
      blocked: block,
      unchanged: added.length === 0 && removed.length === 0,
    }
  }

  function detailDiff(current, suggested) {
    const left = paragraphs(current)
    const right = typeof suggested === 'string' ? paragraphs(suggested) : []
    const sections = []
    if (suggested && typeof suggested === 'object') {
      ;[
        ['overview', 'Product Overview'],
        ['highlights', 'Key Highlights'],
        ['specifications', 'Key Specifications'],
        ['applications', 'Applications'],
        ['packagingDelivery', 'Packaging'],
        ['buyerNote', 'Buyer Note'],
      ].forEach(function (pair) {
        const value = suggested[pair[0]]
        const text = Array.isArray(value)
          ? value
              .map(function (item) {
                if (item && item.name) return item.name + ': ' + (item.value || '')
                return String(item || '')
              })
              .filter(Boolean)
              .join('\n')
          : textOfObject(value)
        if (text) sections.push({ heading: pair[1], text: text })
      })
    } else {
      right.forEach(function (text, i) {
        sections.push({ heading: 'Paragraph ' + (i + 1), text: text })
      })
    }
    return {
      current: left,
      suggested: sections,
      emptyCurrent: left.length === 0,
      emptySuggested: sections.length === 0,
    }
  }

  function textOfObject(value) {
    if (value == null) return ''
    if (typeof value === 'string') return value.trim()
    return String(value).trim()
  }

  function evidencePool(bundle, report) {
    const pool = []
    const product = (bundle && bundle.product) || {}
    ;[
      product.name,
      product.model,
      product.sku,
      product.material,
      product.size,
      product.power,
      product.voltage,
      product.capacity,
      product.moq,
      product.packaging,
    ].forEach(function (item) {
      if (item) pool.push(String(item))
    })
    ;(product.applications || []).forEach(function (item) {
      pool.push(String(item))
    })
    ;((report && report.facts) || []).forEach(function (fact) {
      if (fact && fact.value) pool.push(String(fact.value))
      if (fact && fact.label) pool.push(String(fact.label))
    })
    return pool
  }

  function inPool(token, pool) {
    const low = String(token).toLowerCase()
    return pool.some(function (item) {
      const hay = String(item).toLowerCase()
      return hay === low || hay.indexOf(low) !== -1 || low.indexOf(hay) !== -1
    })
  }

  function titleReasons(current, suggested, bundle, report) {
    const reasons = []
    const pool = evidencePool(bundle, report)
    const currentWords = {}
    words(current).forEach(function (word) {
      currentWords[word.toLowerCase()] = true
    })
    words(suggested).forEach(function (word) {
      if (currentWords[word.toLowerCase()]) return
      if (inPool(word, pool)) reasons.push('增加' + word)
    })
    const blocked = ((report && report.keywords && report.keywords.blocked) || []).map(function (item) {
      return String(item.keyword || item || '').toLowerCase()
    })
    words(current).forEach(function (word) {
      if (blocked.indexOf(word.toLowerCase()) !== -1) reasons.push('删除缺少事实证据的营销描述')
    })
    if ((report && report.debug && report.debug.warnings || []).some(function (item) {
      return /营销|无证据|缺乏证据/i.test(String(item))
    })) {
      reasons.push('删除缺少事实证据的营销描述')
    }
    const unique = []
    reasons.forEach(function (item) {
      if (unique.indexOf(item) === -1) unique.push(item)
    })
    return unique
  }

  ns.diff = {
    words: words,
    titleDiff: titleDiff,
    keywordDiff: keywordDiff,
    detailDiff: detailDiff,
    titleReasons: titleReasons,
    evidencePool: evidencePool,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
