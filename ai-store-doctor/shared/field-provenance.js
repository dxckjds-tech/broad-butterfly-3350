;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const TIERS = {
    T1_EXPLICIT_FORM: 'EXPLICIT_FORM',
    T2_LABEL_ANCHORED: 'LABEL_ANCHORED',
    T3_STRUCTURED_SCRIPT: 'STRUCTURED_SCRIPT',
    T4_JSON_LD: 'JSON_LD',
    T5_PAIRED_ID_TEXT: 'PAIRED_ID_TEXT',
    T6_SEMANTIC_DOM: 'SEMANTIC_DOM',
    T7_SPEC_ROW: 'SPEC_ROW',
    T8_FALLBACK: 'FALLBACK',
  }

  const TRUSTED_VERIFIED = {
    EXPLICIT_FORM: true,
    SPEC_TABLE: true,
    SPEC_ROW: true,
    JSON_LD: true,
    PAIRED_ID_TEXT: true,
    EXPLICIT_PAGE_FIELD: true,
    explicit_form: true,
    spec_table: true,
    spec_row: true,
    json_ld: true,
    paired_id_text: true,
    explicit_page_field: true,
    product_field: true,
    page_label: true,
  }

  const LOW_TRUST = {
    SEMANTIC_DOM: true,
    FALLBACK: true,
    VISION: true,
    REASONING_RECOVERY: true,
    THINKING_RECOVERY: true,
    semantic_dom: true,
    fallback: true,
    vision: true,
    reasoning_recovery: true,
    thinking_recovery: true,
    LABEL_ANCHORED: false,
  }

  const SOURCE_ALIASES = {
    EXPLICIT_FORM: 'explicit_form',
    LABEL_ANCHORED: 'explicit_page_field',
    STRUCTURED_SCRIPT: 'explicit_page_field',
    JSON_LD: 'json_ld',
    PAIRED_ID_TEXT: 'paired_id_text',
    SEMANTIC_DOM: 'semantic_dom',
    SPEC_ROW: 'spec_table',
    FALLBACK: 'fallback',
    REASONING_RECOVERY: 'reasoning_recovery',
    THINKING_RECOVERY: 'reasoning_recovery',
    VISION: 'vision',
  }

  function canon(type) {
    return String(type || '').trim()
  }

  function toLegacySourceType(tierOrType) {
    const raw = canon(tierOrType)
    if (SOURCE_ALIASES[raw]) return SOURCE_ALIASES[raw]
    return raw.toLowerCase()
  }

  function canSupportVerified(sourceType, confidence) {
    const type = canon(sourceType)
    if (LOW_TRUST[type]) return false
    if (!TRUSTED_VERIFIED[type]) return false
    const score = Number(confidence)
    if (!Number.isFinite(score) || score < 70) return false
    return true
  }

  function emptyHit() {
    return {
      value: '',
      tier: '',
      strategy: '',
      confidence: 0,
      selector: null,
      sourceType: '',
      sourceRef: '',
      candidates: [],
    }
  }

  function hit(partial) {
    const row = Object.assign(emptyHit(), partial || {})
    if (!row.sourceType && row.tier) row.sourceType = toLegacySourceType(row.tier)
    return row
  }

  function summarize(map) {
    const out = {}
    Object.keys(map || {}).forEach(function (key) {
      const item = map[key] || {}
      out[key] = {
        tier: item.tier || '',
        strategy: item.strategy || '',
        confidence: item.confidence || 0,
        sourceType: item.sourceType || toLegacySourceType(item.tier),
        sourceRef: item.sourceRef || item.selector || '',
      }
    })
    return out
  }

  ns.fieldProvenance = {
    TIERS: TIERS,
    TRUSTED_VERIFIED: TRUSTED_VERIFIED,
    LOW_TRUST: LOW_TRUST,
    canSupportVerified: canSupportVerified,
    toLegacySourceType: toLegacySourceType,
    emptyHit: emptyHit,
    hit: hit,
    summarize: summarize,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
