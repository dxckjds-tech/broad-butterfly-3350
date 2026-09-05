;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const PAGE_SOURCE = {
    product_field: true,
    spec_table: true,
    spec_row: true,
    json_ld: true,
    page_label: true,
    explicit_page_field: true,
    explicit_form: true,
    paired_id_text: true,
    EXPLICIT_FORM: true,
    SPEC_TABLE: true,
    JSON_LD: true,
    PAIRED_ID_TEXT: true,
    EXPLICIT_PAGE_FIELD: true,
  }
  const EVIDENCE_STATUS = { VERIFIED: true, OBSERVED: true, UNKNOWN: true }
  const FACT_STATUS = { VERIFIED: true, OBSERVED: true, INFERRED: true, UNKNOWN: true }

  function asString(value) {
    return value == null ? '' : String(value)
  }

  function normalizeClaimPart(value) {
    return asString(value)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[，,]/g, '')
  }

  function claimIdentity(item) {
    const row = item || {}
    return [
      normalizeClaimPart(row.field || row.label),
      normalizeClaimPart(row.value),
      normalizeClaimPart(row.sourceType),
      normalizeClaimPart(row.sourceRef),
    ].join('|')
  }

  function asArray(value) {
    return Array.isArray(value) ? value : []
  }

  function toScore(value) {
    if (ASD.schema && typeof ASD.schema.toScore === 'function') return ASD.schema.toScore(value)
    let n = Number(value)
    if (!Number.isFinite(n)) return 0
    if (n > 0 && n <= 1) n = n * 100
    return Math.max(0, Math.min(100, Math.round(n)))
  }

  function fail(errors) {
    return { ok: false, fatal: true, errors: errors, repaired: [], result: null }
  }

  function isPageSource(type) {
    return !!PAGE_SOURCE[String(type || '')]
  }

  function clampEvidenceStatus(status, sourceType, repaired) {
    const up = asString(status).trim().toUpperCase()
    if (up === 'INFERRED') {
      repaired.push('stage1-inferred->OBSERVED')
      return 'OBSERVED'
    }
    if (!EVIDENCE_STATUS[up]) {
      repaired.push('stage1-status->UNKNOWN')
      return 'UNKNOWN'
    }
    if (ASD.fieldProvenance && typeof ASD.fieldProvenance.canSupportVerified === 'function') {
      if (up === 'VERIFIED' && !ASD.fieldProvenance.canSupportVerified(sourceType, 80)) {
        repaired.push('stage1-verified-blocked:' + sourceType)
        return 'OBSERVED'
      }
    } else if (up === 'VERIFIED' && !isPageSource(sourceType)) {
      repaired.push('stage1-verified-blocked:' + sourceType)
      return 'OBSERVED'
    }
    const low = String(sourceType || '')
    if ((low === 'vision' || low === 'REASONING_RECOVERY' || low === 'reasoning_recovery' || low === 'SEMANTIC_DOM' || low === 'FALLBACK') && up === 'VERIFIED') {
      repaired.push('low-trust-cannot-verify')
      return 'OBSERVED'
    }
    return up
  }

  function provenance(item, meta) {
    return {
      sourceType: asString(item.sourceType || (meta && meta.sourceType) || ''),
      sourceRef: asString(item.sourceRef || ''),
      sourceStage: asString(item.sourceStage || (meta && meta.sourceStage) || ''),
      sourceModel: asString(item.sourceModel || (meta && meta.sourceModel) || ''),
      sourceProvider: asString(item.sourceProvider || (meta && meta.sourceProvider) || ''),
    }
  }

  function normalizeEvidence(raw, meta) {
    const repaired = []
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail(['EVIDENCE_NOT_OBJECT'])
    const result = {
      identityCandidates: asArray(raw.identityCandidates)
        .filter(function (item) {
          return item && typeof item === 'object'
        })
        .map(function (item) {
          return {
            name: asString(item.name),
            confidence: toScore(item.confidence),
            evidence: asArray(item.evidence).map(asString),
          }
        }),
      evidence: asArray(raw.evidence)
        .filter(function (item) {
          return item && typeof item === 'object'
        })
        .map(function (item) {
          const sourceType = asString(item.sourceType)
          const ev = Object.assign(
            {
              field: asString(item.field || item.label),
              value: asString(item.value),
              status: clampEvidenceStatus(item.status, sourceType, repaired),
              confidence: toScore(item.confidence),
            },
            provenance(item, Object.assign({}, meta || {}, { sourceType: sourceType, sourceStage: 'evidence' })),
          )
          ev.claimId = claimIdentity(ev)
          return ev
        }),
      imageObservations: asArray(raw.imageObservations)
        .filter(function (item) {
          return item && typeof item === 'object'
        })
        .map(function (item) {
          return {
            imageRef: asString(item.imageRef),
            observation: asString(item.observation),
            confidence: toScore(item.confidence),
          }
        }),
      unknowns: asArray(raw.unknowns).map(asString),
    }
    return { ok: true, fatal: false, errors: [], repaired: repaired, result: result }
  }

  function protectFact(item, prior, repaired) {
    const sourceType = asString(item.sourceType || (prior && prior.sourceType) || '')
    let status = asString(item.status).trim().toUpperCase()
    if (!FACT_STATUS[status]) {
      repaired.push('fact-status->UNKNOWN')
      status = 'UNKNOWN'
    }
    if (prior && prior.sourceType && sourceType && sourceType !== prior.sourceType) {
      repaired.push('provenance-locked:' + prior.sourceType)
    }
    const lockedType = prior && prior.sourceType ? prior.sourceType : sourceType
    if (status === 'VERIFIED' && !isPageSource(lockedType)) {
      repaired.push('verified-requires-page-source')
      status = lockedType === 'vision' ? 'OBSERVED' : status === 'VERIFIED' ? 'INFERRED' : status
      if (lockedType === 'vision') status = 'OBSERVED'
    }
    if (prior && prior.status === 'OBSERVED' && status === 'VERIFIED') {
      repaired.push('observed-cannot-verify')
      status = 'INFERRED'
    }
    if (prior && prior.status === 'INFERRED' && status === 'VERIFIED') {
      repaired.push('inferred-cannot-verify')
      status = 'INFERRED'
    }
    if (prior && prior.status === 'UNKNOWN' && status === 'VERIFIED') {
      repaired.push('unknown-cannot-verify')
      status = 'UNKNOWN'
    }
    return { sourceType: lockedType || sourceType, status: status }
  }

  function indexEvidence(evidence) {
    const map = {}
    ;(evidence || []).forEach(function (item) {
      if (!item) return
      const key = (item.field || '').toLowerCase() + '|' + (item.value || '')
      map[key] = item
      if (item.field) map[String(item.field).toLowerCase()] = item
    })
    return map
  }

  function normalizeDiagnosis(raw, priorEvidence, meta) {
    const repaired = []
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail(['DIAGNOSIS_NOT_OBJECT'])
    const prior = indexEvidence((priorEvidence && priorEvidence.evidence) || [])
    const identity = raw.identity && typeof raw.identity === 'object' ? raw.identity : {}
    const diagnosis = raw.diagnosis && typeof raw.diagnosis === 'object' ? raw.diagnosis : {}
    const keywords = raw.keywordStrategy && typeof raw.keywordStrategy === 'object' ? raw.keywordStrategy : {}
    const brief = raw.contentBrief && typeof raw.contentBrief === 'object' ? raw.contentBrief : {}
    const result = {
      summary: asString(raw.summary),
      identity: {
        name: asString(identity.name),
        confidence: toScore(identity.confidence),
      },
      facts: asArray(raw.facts)
        .filter(function (item) {
          return item && typeof item === 'object'
        })
        .map(function (item) {
          const key = asString(item.field || item.label).toLowerCase()
          const matched = prior[key] || prior[key + '|' + asString(item.value)]
          const guarded = protectFact(item, matched, repaired)
          const fact = Object.assign(
            {
              label: asString(item.label || item.field),
              field: asString(item.field || item.label),
              value: asString(item.value),
              status: guarded.status,
              source: asString(item.source || item.sourceRef),
              note: asString(item.note),
              confidence: toScore(item.confidence),
            },
            provenance(
              Object.assign({}, item, { sourceType: guarded.sourceType }),
              Object.assign({}, meta || {}, { sourceStage: 'diagnosis' }),
            ),
          )
          fact.claimId = claimIdentity(fact)
          return fact
        }),
      diagnosis: {
        strengths: asArray(diagnosis.strengths).map(asString),
        issues: asArray(diagnosis.issues).map(asString),
        priorities: asArray(diagnosis.priorities).map(asString),
      },
      keywordStrategy: {
        primary: asArray(keywords.primary).map(asString),
        secondary: asArray(keywords.secondary).map(asString),
        blocked: asArray(keywords.blocked).map(asString),
        rationale: asArray(keywords.rationale).map(asString),
      },
      contentBrief: {
        titleGoals: asArray(brief.titleGoals).map(asString),
        detailGoals: asArray(brief.detailGoals).map(asString),
        faqGoals: asArray(brief.faqGoals).map(asString),
        geoGoals: asArray(brief.geoGoals).map(asString),
      },
    }
    return { ok: true, fatal: false, errors: [], repaired: repaired, result: result }
  }

  function unknownValues(diagnosis) {
    const blocked = {}
    asArray(diagnosis && diagnosis.facts).forEach(function (fact) {
      if (fact && fact.status === 'UNKNOWN' && fact.value) blocked[String(fact.value).toLowerCase()] = true
    })
    return blocked
  }

  function stripUnknownSpecs(specs, blocked, repaired) {
    return asArray(specs).filter(function (item) {
      if (!item) return false
      const value = asString(item.value).toLowerCase()
      if (value && blocked[value]) {
        repaired.push('unknown-fact-removed-from-content')
        return false
      }
      return true
    })
  }

  function normalizeContentStage(raw, diagnosis) {
    if (!ASD.schema || typeof ASD.schema.normalizeAndValidate !== 'function') return fail(['SCHEMA_UNAVAILABLE'])
    const repaired = []
    const blocked = unknownValues(diagnosis)
    const identity = (diagnosis && diagnosis.identity && diagnosis.identity.name) || ''
    const envelope = {
      summary: {
        identity: identity,
        confidence: diagnosis && diagnosis.identity ? diagnosis.identity.confidence : 0,
        dataCompleteness: raw && raw.summary ? raw.summary.dataCompleteness : 0,
        contentReadiness: raw && raw.summary ? raw.summary.contentReadiness : 0,
        status: raw && raw.summary ? raw.summary.status : 'UNKNOWN',
        conflicts: raw && raw.summary ? raw.summary.conflicts : [],
        nextActions: raw && raw.summary ? raw.summary.nextActions : [],
      },
      identityCandidates: raw && raw.identityCandidates,
      facts: (diagnosis && diagnosis.facts) || [],
      keywords: raw && raw.keywords,
      content: raw && raw.content,
      debug: raw && raw.debug,
    }
    if (envelope.content && envelope.content.detail && Array.isArray(envelope.content.detail.specifications)) {
      envelope.content.detail.specifications = stripUnknownSpecs(envelope.content.detail.specifications, blocked, repaired)
    }
    const validated = ASD.schema.normalizeAndValidate(envelope)
    if (!validated.ok) return validated
    validated.repaired = (validated.repaired || []).concat(repaired)
    return validated
  }

  const VERIFY_DECISION = { confirm: true, downgrade: true, reject: true }
  const VERIFY_STATUS = { VERIFIED: true, OBSERVED: true, INFERRED: true, UNKNOWN: true }

  function normalizeVerification(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail(['VERIFICATION_NOT_OBJECT'])
    if (Object.prototype.hasOwnProperty.call(raw, 'newFacts') || Object.prototype.hasOwnProperty.call(raw, 'suggestedFacts')) {
      return fail(['VERIFIER_CANNOT_ADD_FACTS'])
    }
    const decisions = asArray(raw.decisions)
    if (!decisions.length) return fail(['VERIFICATION_NO_DECISIONS'])
    const normalized = []
    for (let i = 0; i < decisions.length; i += 1) {
      const item = decisions[i]
      if (!item || typeof item !== 'object') return fail(['INVALID_DECISION'])
      const decision = asString(item.decision).toLowerCase()
      if (!VERIFY_DECISION[decision]) return fail(['INVALID_DECISION:' + decision])
      let toStatus = item.toStatus == null || item.toStatus === '' ? null : asString(item.toStatus).toUpperCase()
      if (toStatus && !VERIFY_STATUS[toStatus]) toStatus = null
      normalized.push({
        claimId: asString(item.claimId),
        decision: decision,
        toStatus: toStatus,
        reasonCode: asString(item.reasonCode),
        explanation: asString(item.explanation),
      })
    }
    return { ok: true, fatal: false, errors: [], repaired: [], result: { decisions: normalized } }
  }

  function applyVerifierDecisions(diagnosis, verification) {
    const counts = { confirmed: 0, downgraded: 0, rejected: 0 }
    const rejected = []
    const byId = {}
    asArray(verification && verification.decisions).forEach(function (item) {
      if (!item || !item.claimId) return
      const raw = String(item.claimId)
      byId[raw] = item
      byId[raw.toLowerCase()] = item
    })
    const facts = asArray(diagnosis && diagnosis.facts)
      .map(function (fact) {
        if (!fact) return null
        const id = asString(fact.claimId) || claimIdentity(fact)
        const dec = byId[id] || byId[id.toLowerCase()]
        if (!dec) return fact
        if (dec.decision === 'reject') {
          counts.rejected += 1
          rejected.push({ claimId: id, label: fact.label, field: fact.field || fact.label, value: fact.value, sourceType: fact.sourceType, sourceRef: fact.sourceRef, sourceStage: fact.sourceStage })
          return null
        }
        const next = Object.assign({}, fact)
        if (dec.decision === 'downgrade') {
          counts.downgraded += 1
          let to = dec.toStatus || 'OBSERVED'
          if (to === 'VERIFIED' && !isPageSource(next.sourceType)) to = 'OBSERVED'
          next.status = to
        } else if (dec.decision === 'confirm') {
          counts.confirmed += 1
          let to = dec.toStatus || next.status
          if (to === 'VERIFIED' && !isPageSource(next.sourceType)) to = next.sourceType === 'vision' ? 'OBSERVED' : 'OBSERVED'
          next.status = to
        }
        return next
      })
      .filter(Boolean)
    return {
      diagnosis: Object.assign({}, diagnosis, { facts: facts }),
      rejected: rejected,
      counts: counts,
    }
  }

  function finalizeOrchestrationReport(diagnosis, content, extras) {
    const contentNorm = normalizeContentStage(content && content.content ? content : { content: content, keywords: content && content.keywords, summary: content && content.summary }, diagnosis)
    if (!contentNorm.ok) return contentNorm
    const report = contentNorm.result
    if (diagnosis && diagnosis.identity && diagnosis.identity.name) {
      report.summary.identity = diagnosis.identity.name
      report.summary.confidence = diagnosis.identity.confidence
    }
    if (diagnosis && diagnosis.facts && diagnosis.facts.length) report.facts = diagnosis.facts
    if (diagnosis && diagnosis.summary && !report.summary.nextActions.length) {
      report.debug.warnings = (report.debug.warnings || []).concat(['diagnosis-summary:' + diagnosis.summary])
    }
    report.debug.orchestration = extras || null
    return { ok: true, fatal: false, errors: [], repaired: contentNorm.repaired || [], result: report }
  }

  ns.orchestrationSchemas = {
    PAGE_SOURCE: PAGE_SOURCE,
    normalizeClaimPart: normalizeClaimPart,
    claimIdentity: claimIdentity,
    normalizeEvidence: normalizeEvidence,
    normalizeDiagnosis: normalizeDiagnosis,
    normalizeContentStage: normalizeContentStage,
    normalizeVerification: normalizeVerification,
    applyVerifierDecisions: applyVerifierDecisions,
    finalizeOrchestrationReport: finalizeOrchestrationReport,
    isPageSource: isPageSource,
    protectFact: protectFact,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
