;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const CRITICAL = /^(material|model|certification|certifications|power|voltage|capacity|材质|型号|认证|功率|电压|容量)$/i
  const TRUSTED = {
    product_field: true,
    spec_table: true,
    spec_row: true,
    json_ld: true,
    explicit_page_field: true,
    explicit_form: true,
    paired_id_text: true,
    EXPLICIT_FORM: true,
    SPEC_TABLE: true,
    JSON_LD: true,
    PAIRED_ID_TEXT: true,
    EXPLICIT_PAGE_FIELD: true,
  }

  function fieldKey(item) {
    return String((item && (item.field || item.label)) || '')
      .toLowerCase()
      .replace(/\s+/g, '')
  }

  function normVal(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[，,]/g, '')
  }

  function isCritical(item) {
    return CRITICAL.test(fieldKey(item))
  }

  function toClaim(fact, reason) {
    const schemas = ASD.orchestrationSchemas
    const id =
      (fact && fact.claimId) ||
      (schemas && typeof schemas.claimIdentity === 'function' ? schemas.claimIdentity(fact) : fieldKey(fact) || String((fact && fact.value) || ''))
    return {
      claimId: id,
      field: (fact && (fact.field || fact.label)) || '',
      value: (fact && fact.value) || '',
      status: (fact && fact.status) || '',
      sourceType: (fact && fact.sourceType) || '',
      sourceRef: (fact && fact.sourceRef) || '',
      sourceStage: (fact && fact.sourceStage) || '',
      reason: reason,
    }
  }

  function unique(list) {
    const seen = {}
    return (list || []).filter(function (item) {
      const key = String(item)
      if (seen[key]) return false
      seen[key] = true
      return true
    })
  }

  function dedupeClaims(list) {
    const seen = {}
    return (list || []).filter(function (item) {
      const key = item.claimId + '|' + item.value + '|' + item.reason
      if (seen[key]) return false
      seen[key] = true
      return true
    })
  }

  function pageSpecs(bundle) {
    const map = {}
    const product = (bundle && (bundle.product || bundle)) || {}
    const specs = product.specifications || (product.product && product.product.specifications) || []
    ;(Array.isArray(specs) ? specs : []).forEach(function (row) {
      if (!row) return
      const key = String(row.name || row.label || row.field || '')
        .toLowerCase()
        .replace(/\s+/g, '')
      if (key && row.value) map[key] = String(row.value)
    })
    ;['material', 'model', 'power', 'voltage', 'capacity'].forEach(function (key) {
      const value = product[key] || (product.product && product.product[key])
      if (value && !map[key]) map[key] = String(value)
    })
    return map
  }

  function assessVerificationRisk(input) {
    const ctx = input || {}
    const diagnosis = ctx.diagnosis || {}
    const stage1 = ctx.stage1 || ctx.evidence || {}
    const health = ctx.health || {}
    const orch = ctx.orchestration || {}
    const reasons = []
    const claims = []
    let score = 0

    const identity = diagnosis.identity || {}
    if (identity.confidence != null && Number(identity.confidence) < 60) {
      score += 25
      reasons.push('low_identity_confidence')
    }

    const facts = Array.isArray(diagnosis.facts) ? diagnosis.facts : []
    const evidence = Array.isArray(stage1.evidence) ? stage1.evidence : []
    const page = pageSpecs(ctx.productBundle || ctx.product)

    facts.forEach(function (fact) {
      if (!fact) return
      const sourceType = String(fact.sourceType || '')
      const trusted =
        ASD.fieldProvenance && typeof ASD.fieldProvenance.canSupportVerified === 'function'
          ? ASD.fieldProvenance.canSupportVerified(sourceType, fact.confidence != null ? fact.confidence : 80)
          : !!TRUSTED[sourceType]
      const critical = isCritical(fact)
      if (String(fact.contentSource || '').toUpperCase() === 'REASONING_RECOVERY') {
        score += 20
        reasons.push('reasoning_recovery')
      }

      if (String(fact.status || '').toUpperCase() === 'VERIFIED' && !trusted) {
        score += 30
        reasons.push('verified_without_trusted_source')
        claims.push(toClaim(fact, 'untrusted_verified'))
      }

      if (critical && String(fact.sourceType || '') === 'vision') {
        score += String(fact.status || '').toUpperCase() === 'VERIFIED' ? 40 : 25
        reasons.push('vision_only_critical_fact')
        claims.push(toClaim(fact, 'vision_only_critical'))
      }

      const pageValue = page[fieldKey(fact)]
      if (pageValue && fact.value && normVal(pageValue) !== normVal(fact.value)) {
        score += critical ? 60 : 30
        reasons.push('fact_conflict')
        claims.push(toClaim(fact, 'conflict'))
        claims.push(
          toClaim(
            {
              field: fieldKey(fact),
              label: (fact && (fact.field || fact.label)) || fieldKey(fact),
              value: pageValue,
              status: 'VERIFIED',
              sourceType: 'spec_table',
              sourceRef: fieldKey(fact),
              sourceStage: 'page',
            },
            'conflict_page',
          ),
        )
      }

      const weak = String(fact.status || '').toUpperCase()
      if (critical && (weak === 'OBSERVED' || weak === 'INFERRED') && ctx.contentUsesWeakFacts) {
        score += 20
        reasons.push('weak_evidence_in_content')
        claims.push(toClaim(fact, 'weak_in_content'))
      }
    })

    evidence.forEach(function (item) {
      if (!item) return
      const fact = facts.filter(function (row) {
        return fieldKey(row) === fieldKey(item)
      })[0]
      if (fact && item.value && fact.value && normVal(item.value) !== normVal(fact.value)) {
        score += 30
        reasons.push('stage_conflict')
        claims.push(toClaim(fact, 'stage_conflict'))
      }
    })

    if (orch.schemaRepaired || (ctx.repairedFacts && ctx.repairedFacts.length)) {
      score += 15
      reasons.push('schema_repair')
    }

    if ((health.consecutiveFailures || 0) >= 3) {
      score += 15
      reasons.push('unhealthy_reasoning_model')
    }

    const specs = ctx.content && ctx.content.detail && ctx.content.detail.specifications
    if (Array.isArray(specs)) {
      specs.forEach(function (spec) {
        const fact = facts.filter(function (row) {
          return fieldKey(row) === fieldKey(spec) || normVal(row.value) === normVal(spec && spec.value)
        })[0]
        if (!fact) return
        const st = String(fact.status || '').toUpperCase()
        if (st === 'OBSERVED' || st === 'INFERRED') {
          score += 15
          reasons.push('weak_evidence_in_content')
          claims.push(toClaim(fact, 'weak_in_content'))
        }
        if (st === 'UNKNOWN') {
          score += 20
          reasons.push('unknown_in_content')
          claims.push(toClaim(fact, 'unknown_in_content'))
        }
      })
    }

    score = Math.max(0, Math.min(100, score))
    const level = score < 30 ? 'low' : score < 60 ? 'medium' : 'high'
    return {
      score: score,
      level: level,
      reasons: unique(reasons),
      requiresVerification: level === 'high',
      claimsToVerify: dedupeClaims(claims),
    }
  }

  ns.bg.verificationRisk = {
    CRITICAL: CRITICAL,
    TRUSTED: TRUSTED,
    assessVerificationRisk: assessVerificationRisk,
    fieldKey: fieldKey,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
