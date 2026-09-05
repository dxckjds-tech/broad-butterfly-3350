;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.sidepanel = ns.sidepanel || {}

  function maxRecords() {
    return (ASD.constants && ASD.constants.HISTORY_MAX) || 100
  }

  function nextId() {
    return 'h_' + Date.now() + '_' + Math.random().toString(16).slice(2)
  }

  function indexKey() {
    return ASD.storageKeys.HIST_INDEX
  }

  function itemKey(id) {
    return ASD.storageKeys.histItem(id)
  }

  function stripHeavy(value) {
    if (typeof value === 'string') {
      if (/^data:image\//i.test(value)) return null
      return value
    }
    if (Array.isArray(value)) {
      return value
        .map(stripHeavy)
        .filter(function (item) {
          return item != null
        })
    }
    if (value && typeof value === 'object') {
      const out = {}
      Object.keys(value).forEach(function (key) {
        if (key === 'fallbackText' || key === 'images' || key === 'visibleText' || key === 'html') return
        const next = stripHeavy(value[key])
        if (next != null) out[key] = next
      })
      return out
    }
    return value
  }

  function snapshot(bundle) {
    const product = (bundle && bundle.product) || {}
    const current = (bundle && bundle.current) || {}
    const company = (bundle && bundle.company) || {}
    return {
      current: {
        title: current.title || null,
        keywords: Array.isArray(current.keywords) ? current.keywords.slice() : [],
        description: current.description || null,
      },
      product: {
        name: product.name || null,
        category: product.category || null,
        model: product.model || null,
        brand: product.brand || null,
        sku: product.sku || null,
        keywords: Array.isArray(product.keywords) ? product.keywords.slice() : [],
        price: product.price || null,
        moq: product.moq || null,
        specifications: Array.isArray(product.specifications) ? product.specifications.slice() : [],
        material: product.material || null,
        size: product.size || null,
        power: product.power || null,
        voltage: product.voltage || null,
        capacity: product.capacity || null,
        applications: Array.isArray(product.applications) ? product.applications.slice() : [],
        certifications: Array.isArray(product.certifications) ? product.certifications.slice() : [],
        packaging: product.packaging || null,
        deliveryTime: product.deliveryTime || null,
      },
      company: { name: company.name || null, profile: company.profile || null },
    }
  }

  function sanitizeValue(value) {
    if (ASD.sanitize && typeof ASD.sanitize.sanitizeCollected === 'function') {
      return ASD.sanitize.sanitizeCollected(value)
    }
    return value
  }

  async function list() {
    const raw = await chrome.storage.local.get(indexKey())
    const rows = raw[indexKey()]
    return Array.isArray(rows) ? rows : []
  }

  async function get(id) {
    const key = itemKey(id)
    const raw = await chrome.storage.local.get(key)
    return raw[key] || null
  }

  async function trimIndex(rows) {
    const sorted = rows.slice().sort(function (a, b) {
      return String(a.createdAt || '') < String(b.createdAt || '') ? -1 : String(a.createdAt || '') > String(b.createdAt || '') ? 1 : 0
    })
    const removed = []
    while (sorted.length > maxRecords()) removed.push(sorted.shift())
    if (removed.length) {
      await chrome.storage.local.remove(
        removed.map(function (row) {
          return itemKey(row.id)
        }),
      )
    }
    return sorted
  }

  async function prune() {
    const next = await trimIndex(await list())
    const patch = {}
    patch[indexKey()] = next
    await chrome.storage.local.set(patch)
    return next
  }

  async function put(input) {
    input = input || {}
    const id = input.id || nextId()
    const createdAt = input.createdAt || new Date().toISOString()
    const snap = sanitizeValue(stripHeavy(input.productSnapshot || snapshot(input.product)))
    const report = sanitizeValue(
      stripHeavy({
        summary: input.summary || (input.report && input.report.summary) || null,
        facts: input.facts || (input.report && input.report.facts) || [],
        keywords: input.keywords || (input.report && input.report.keywords) || {},
        content: input.content || (input.report && input.report.content) || {},
      }),
    )
    const record = {
      id: id,
      url: input.url || '',
      productName: input.productName || (snap.product && snap.product.name) || '',
      productIdentity: input.productIdentity || '',
      healthScore: input.healthScore || 0,
      healthDimensions: input.healthDimensions || [],
      confidence: input.confidence || 0,
      summary: report.summary,
      facts: report.facts,
      keywords: report.keywords,
      content: report.content,
      model: input.model || '',
      provider: input.provider || '',
      createdAt: createdAt,
      promptVersion: input.promptVersion || (ASD.constants && ASD.constants.PROMPT_VERSION) || '',
      schemaVersion: input.schemaVersion || (ASD.constants && ASD.constants.SCHEMA_VERSION) || '',
      scoreVersion: input.scoreVersion || (ASD.healthScore && ASD.healthScore.SCORE_VERSION) || '',
      extensionVersion: input.extensionVersion || (ASD.constants && ASD.constants.EXTENSION_VERSION) || '',
      productSnapshot: snap,
    }
    const itemPatch = {}
    itemPatch[itemKey(id)] = record
    await chrome.storage.local.set(itemPatch)
    let index = (await list()).filter(function (row) {
      return row.id !== id
    })
    index.push({
      id: id,
      productName: record.productName,
      url: record.url,
      healthScore: record.healthScore,
      createdAt: record.createdAt,
      model: record.model,
      productIdentity: record.productIdentity,
    })
    index = await trimIndex(index)
    const idxPatch = {}
    idxPatch[indexKey()] = index
    await chrome.storage.local.set(idxPatch)
    return record
  }

  async function remove(id) {
    await chrome.storage.local.remove(itemKey(id))
    const index = (await list()).filter(function (row) {
      return row.id !== id
    })
    const patch = {}
    patch[indexKey()] = index
    await chrome.storage.local.set(patch)
    return true
  }

  async function clear() {
    const index = await list()
    const keys = index.map(function (row) {
      return itemKey(row.id)
    })
    keys.push(indexKey())
    await chrome.storage.local.remove(keys)
  }

  ns.sidepanel.historyStore = { list: list, get: get, put: put, remove: remove, prune: prune, clear: clear, snapshot: snapshot }
})(typeof globalThis !== 'undefined' ? globalThis : self)
