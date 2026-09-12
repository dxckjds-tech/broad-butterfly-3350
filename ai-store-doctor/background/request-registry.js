;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const inflight = new Map()

  function fingerprint(parts) {
    return JSON.stringify({
      url: parts.url || '',
      title: parts.title || '',
      name: parts.name || '',
      model: parts.model || '',
      promptVersion: parts.promptVersion || '',
    })
  }

  function run(key, fn) {
    if (inflight.has(key)) return inflight.get(key)
    const pending = Promise.resolve()
      .then(fn)
      .finally(function () {
        inflight.delete(key)
      })
    inflight.set(key, pending)
    return pending
  }

  function nextId(prefix) {
    return (prefix || 'req') + '_' + Date.now() + '_' + Math.random().toString(16).slice(2)
  }

  function size() {
    return inflight.size
  }

  ns.bg.requests = { fingerprint, run, nextId, size }
})(typeof globalThis !== 'undefined' ? globalThis : self)
