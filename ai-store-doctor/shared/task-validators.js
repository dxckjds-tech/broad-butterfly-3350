;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  function fail(errors) {
    return { ok: false, fatal: false, errors: errors, repaired: [], result: null }
  }

  function connectionTest(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail(['CONNECTION_NOT_OBJECT'])
    if (raw.ok !== true) return fail(['CONNECTION_NOT_OK'])
    return {
      ok: true,
      repaired: [],
      result: { ok: true, message: raw.message != null ? String(raw.message) : '连接成功' },
    }
  }

  function translation(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail(['TRANSLATION_NOT_OBJECT'])
    const text = raw.translation != null ? String(raw.translation).trim() : ''
    if (!text) return fail(['MISSING_TRANSLATION'])
    return { ok: true, repaired: [], result: { translation: text } }
  }

  function rawJson(raw) {
    if (raw == null) return fail(['EMPTY_JSON'])
    return { ok: true, repaired: [], result: raw }
  }

  function productDiagnosis(raw) {
    if (!ASD.schema || typeof ASD.schema.normalizeAndValidate !== 'function') {
      return fail(['SCHEMA_UNAVAILABLE'])
    }
    return ASD.schema.normalizeAndValidate(raw)
  }

  function validateByTask(task, raw) {
    const name = String(task || ns.taskTypes.PRODUCT_DIAGNOSIS)
    if (name === ns.taskTypes.CONNECTION_TEST) return connectionTest(raw)
    if (name === ns.taskTypes.TRANSLATION) return translation(raw)
    if (name === ns.taskTypes.RAW_JSON) return rawJson(raw)
    if (name === ns.taskTypes.MODEL_LIST) return rawJson(raw)
    if (name === ns.taskTypes.PRODUCT_DIAGNOSIS) return productDiagnosis(raw)
    if (name === ns.taskTypes.EVIDENCE_ANALYSIS || name === 'evidence_analysis') {
      if (!ns.orchestrationSchemas || typeof ns.orchestrationSchemas.normalizeEvidence !== 'function') {
        return fail(['ORCHESTRATION_SCHEMA_UNAVAILABLE'])
      }
      return ns.orchestrationSchemas.normalizeEvidence(raw)
    }
    if (name === ns.taskTypes.DIAGNOSIS_REASONING || name === 'diagnosis_reasoning') {
      if (!ns.orchestrationSchemas || typeof ns.orchestrationSchemas.normalizeDiagnosis !== 'function') {
        return fail(['ORCHESTRATION_SCHEMA_UNAVAILABLE'])
      }
      return ns.orchestrationSchemas.normalizeDiagnosis(raw)
    }
    if (
      name === ns.taskTypes.CONTENT_GENERATION ||
      name === 'content_generation' ||
      name === ns.taskTypes.DIAGNOSIS_AND_CONTENT ||
      name === 'diagnosis_and_content'
    ) {
      if (!ns.orchestrationSchemas || typeof ns.orchestrationSchemas.normalizeContentStage !== 'function') {
        return productDiagnosis(raw)
      }
      return ns.orchestrationSchemas.normalizeContentStage(raw)
    }
    return productDiagnosis(raw)
  }

  ns.taskValidators = {
    validateByTask: validateByTask,
    connectionTest: connectionTest,
    translation: translation,
    rawJson: rawJson,
    productDiagnosis: productDiagnosis,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
