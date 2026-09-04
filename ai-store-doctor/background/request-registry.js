;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  // Step 9 will add inflight Map / AbortController / requestId.
  // Empty on purpose in Step 2 so SW restart semantics stay unchanged.
  ns.bg.requestRegistry = {}
})(typeof globalThis !== 'undefined' ? globalThis : self)
