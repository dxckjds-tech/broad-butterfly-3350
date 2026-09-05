;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const PAGE_RANK = {
    spec_table: 100,
    SPEC_TABLE: 100,
    spec_row: 100,
    explicit_form: 90,
    EXPLICIT_FORM: 90,
    product_field: 88,
    explicit_page_field: 86,
    EXPLICIT_PAGE_FIELD: 86,
    json_ld: 80,
    JSON_LD: 80,
    paired_id_text: 84,
    PAIRED_ID_TEXT: 84,
    page_label: 70,
  }

  function fieldKey(item) {
    return String((item && (item.field || item.label || item.name)) || '')
      .toLowerCase()
      .replace(/\s+/g, '')
  }

  function normVal(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[，,]/g, '')
  }

  function pageFacts(bundle, provenance) {
    const map = {}
    const product = (bundle && (bundle.product || bundle)) || {}
    const specs = product.specifications || (product.product && product.product.specifications) || []
    ;(Array.isArray(specs) ? specs : []).forEach(function (row) {
      if (!row || !row.value) return
      const key = fieldKey({ field: row.name || row.label })
      if (!key) return
      map[key] = {
        field: row.name || row.label,
        value: String(row.value),
        sourceType: 'spec_table',
        sourceRef: row.name || row.label,
        status: 'VERIFIED',
        confidence: 90,
        rank: 100,
      }
    })
    ;['material', 'model', 'power', 'voltage', 'capacity', 'sku', 'brand'].forEach(function (key) {
      const value = product[key] || (product.product && product.product[key])
      if (!value) return
      const prov = provenance && (provenance[key] || provenance.productName)
      map[key] = {
        field: key,
        value: String(value),
        sourceType: (prov && prov.sourceType) || 'explicit_form',
        sourceRef: (prov && prov.sourceRef) || 'product.' + key,
        status: 'VERIFIED',
        confidence: (prov && prov.confidence) || 90,
        rank: PAGE_RANK[(prov && prov.sourceType) || 'explicit_form'] || 88,
      }
    })
    return map
  }

  function trusted(sourceType, confidence, contentSource) {
    if (String(contentSource || '').toUpperCase() === 'REASONING_RECOVERY') return false
    if (ASD.fieldProvenance && typeof ASD.fieldProvenance.canSupportVerified === 'function') {
      return ASD.fieldProvenance.canSupportVerified(sourceType, confidence)
    }
    return !!PAGE_RANK[sourceType]
  }

  function fuse(input) {
    const ctx = input || {}
    const report = ctx.report && typeof ctx.report === 'object' ? JSON.parse(JSON.stringify(ctx.report)) : { facts: [] }
    const page = pageFacts(ctx.productBundle || ctx.product, ctx.fieldProvenance || (ctx.productBundle && ctx.productBundle.fieldProvenance))
    const roleFacts = []
    ;['evidence', 'reasoning', 'keywords', 'content'].forEach(function (role) {
      const out = ctx.roles && ctx.roles[role]
      const facts = (out && (out.facts || out.evidence)) || []
      facts.forEach(function (fact) {
        roleFacts.push(Object.assign({ role: role }, fact))
      })
    })

    const fused = []
    const seen = {}
    Object.keys(page).forEach(function (key) {
      const base = page[key]
      const votes = roleFacts.filter(function (item) {
        return fieldKey(item) === key && item.value && normVal(item.value) !== normVal(base.value)
      })
      fused.push({
        label: base.field,
        field: key,
        value: base.value,
        status: trusted(base.sourceType, base.confidence) ? 'VERIFIED' : 'OBSERVED',
        sourceType: base.sourceType,
        sourceRef: base.sourceRef,
        sourceStage: 'page',
        confidence: base.confidence,
        note: votes.length ? 'model_consensus_ignored' : '',
      })
      votes.forEach(function (vote) {
        fused.push({
          label: vote.field || vote.label || base.field,
          field: key,
          value: String(vote.value),
          status: 'CONFLICT',
          sourceType: vote.sourceType || 'model_inference',
          sourceRef: vote.sourceRef || vote.role,
          sourceStage: vote.role || 'reasoning',
          confidence: vote.confidence || 40,
          note: 'conflicts_with_page',
        })
      })
      seen[key] = true
    })

    ;(report.facts || []).forEach(function (fact) {
      const key = fieldKey(fact)
      if (!key || seen[key]) {
        if (seen[key] && fact && page[key] && fact.value && normVal(fact.value) !== normVal(page[key].value)) {
          return
        }
        if (seen[key]) return
      }
      const contentSource = fact.contentSource || ctx.contentSource || ''
      if (String(fact.status || '').toUpperCase() === 'VERIFIED' && !trusted(fact.sourceType, fact.confidence, contentSource)) {
        fact.status = 'OBSERVED'
      }
      fused.push(fact)
      seen[key] = true
    })

    report.facts = fused
    report.debug = report.debug || {}
    report.debug.fusion = {
      pagePriority: true,
      votingDisabled: true,
      recovered: String(ctx.contentSource || '') === 'REASONING_RECOVERY',
    }
    return { result: report, conflicts: fused.filter(function (item) { return item.status === 'CONFLICT' }) }
  }

  ns.bg.fusionEngine = {
    fuse: fuse,
    pageFacts: pageFacts,
    trusted: trusted,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
