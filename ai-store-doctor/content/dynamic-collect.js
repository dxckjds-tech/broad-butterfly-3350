;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.content = ns.content || {}

  const DEBOUNCE_MS = 400
  const POLL_MS = 800
  const MAX_POLLS = 6
  const STABLE_ROUNDS = 2
  const HARD_CAP_MS = 6500

  function collectNow() {
    if (typeof collectDualTrack === 'function') return collectDualTrack()
    if (ns.content.collect) return ns.content.collect()
    throw new Error('COLLECT_UNAVAILABLE')
  }

  function scoreOf(snapshot) {
    if (!ASD.productFields || typeof ASD.productFields.qualityScore !== 'function') return 0
    return ASD.productFields.qualityScore(snapshot.fields, snapshot.product)
  }

  function hasCore(snapshot) {
    if (!ASD.productFields || typeof ASD.productFields.hasCoreFields !== 'function') return false
    return ASD.productFields.hasCoreFields(snapshot.fields, snapshot.product)
  }

  function rootFound(snapshot) {
    return !!(snapshot && snapshot.product && snapshot.product.debug && snapshot.product.debug.productRootFound)
  }

  function attachPerf(snapshot, stats) {
    const product = snapshot && snapshot.product
    if (!product) return snapshot
    product.debug = product.debug || {}
    product.debug.readDurationMs = stats.readDurationMs
    product.debug.sampleCount = stats.sampleCount
    product.debug.observerTriggeredCount = stats.observerTriggeredCount
    product.debug.finalQualityScore = stats.finalQualityScore
    return snapshot
  }

  function collectUntilStable() {
    return new Promise(function (resolve) {
      const started = Date.now()
      let best = null
      let bestScore = -1
      let stable = 0
      let sampleCount = 0
      let observerTriggeredCount = 0
      let polls = 0
      let debounceTimer = null
      let pollTimer = null
      let hardTimer = null
      let observer = null
      let observedRoot = null
      let settled = false

      function stats() {
        return {
          readDurationMs: Date.now() - started,
          sampleCount: sampleCount,
          observerTriggeredCount: observerTriggeredCount,
          finalQualityScore: bestScore < 0 ? 0 : bestScore,
        }
      }

      function disconnect() {
        clearTimeout(debounceTimer)
        clearTimeout(pollTimer)
        clearTimeout(hardTimer)
        if (observer) {
          observer.disconnect()
          observer = null
          observedRoot = null
        }
      }

      function finish() {
        if (settled) return
        settled = true
        disconnect()
        const out = best || collectNow()
        ns.content.dynamic.extractCount = sampleCount
        resolve(attachPerf(out, stats()))
      }

      function attachObserver() {
        if (settled || typeof MutationObserver !== 'function') return
        const root = ASD.content.dom && ASD.content.dom.findProductRoot(document)
        if (!root || root === document.body) return
        if (observer && observedRoot === root) return
        if (observer) observer.disconnect()
        observedRoot = root
        observer = new MutationObserver(function () {
          if (settled) return
          observerTriggeredCount += 1
          ns.content.dynamic.observerTriggeredCount = observerTriggeredCount
          clearTimeout(debounceTimer)
          debounceTimer = setTimeout(runExtract, DEBOUNCE_MS)
        })
        observer.observe(root, { childList: true, subtree: true })
      }

      function runExtract() {
        if (settled) return
        const snapshot = collectNow()
        sampleCount += 1
        ns.content.dynamic.extractCount = sampleCount
        const score = scoreOf(snapshot)
        if (score > bestScore) {
          bestScore = score
          best = snapshot
          stable = 0
        } else {
          stable += 1
        }
        attachObserver()
        const core = hasCore(best || snapshot)
        const rooted = rootFound(best || snapshot)
        if (!rooted && !core && stable >= 1) {
          finish()
          return
        }
        if (core && stable >= 1 && observerTriggeredCount === 0 && sampleCount >= 2) {
          finish()
          return
        }
        if (core && stable >= STABLE_ROUNDS) {
          finish()
          return
        }
        if (polls >= MAX_POLLS) finish()
      }

      function poll() {
        if (settled) return
        polls += 1
        if (polls > MAX_POLLS) {
          finish()
          return
        }
        runExtract()
        if (!settled) pollTimer = setTimeout(poll, POLL_MS)
      }

      runExtract()
      if (!settled && !rootFound(best) && !hasCore(best)) {
        runExtract()
        if (!settled) finish()
        return
      }
      attachObserver()
      if (!settled) pollTimer = setTimeout(poll, POLL_MS)
      if (!settled && hasCore(best)) debounceTimer = setTimeout(runExtract, DEBOUNCE_MS)
      hardTimer = setTimeout(finish, HARD_CAP_MS)
    })
  }

  function resetSession() {
    ns.content.dynamic.extractCount = 0
    ns.content.dynamic.observerTriggeredCount = 0
  }

  ns.content.dynamic = {
    DEBOUNCE_MS: DEBOUNCE_MS,
    POLL_MS: POLL_MS,
    MAX_POLLS: MAX_POLLS,
    STABLE_ROUNDS: STABLE_ROUNDS,
    extractCount: 0,
    observerTriggeredCount: 0,
    collectUntilStable: collectUntilStable,
    resetSession: resetSession,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
