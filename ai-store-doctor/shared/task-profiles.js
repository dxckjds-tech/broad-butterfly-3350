;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const PROFILES = {
    product_identity: {
      required: { structuredOutput: true, text: true },
      preferred: { vision: true, reasoning: true },
      weights: { writingQuality: 0.3, reasoning: 0.3, jsonReliability: 0.4 },
    },
    fact_extraction: {
      required: { structuredOutput: true, text: true },
      preferred: { reasoning: true },
      weights: { jsonReliability: 0.5, reasoning: 0.3, speed: 0.2 },
    },
    product_diagnosis: {
      required: { structuredOutput: true, text: true },
      preferred: { vision: true, reasoning: true },
      weights: { jsonReliability: 0.35, reasoning: 0.25, writingQuality: 0.2, vision: 0.2 },
    },
    vision_analysis: {
      required: { vision: true, text: true },
      preferred: { reasoning: true },
      weights: { vision: 0.6, reasoning: 0.2, jsonReliability: 0.2 },
    },
    title_generation: {
      required: { text: true },
      preferred: { reasoning: true, structuredOutput: true },
      weights: { writingQuality: 0.6, reasoning: 0.2, speed: 0.2 },
    },
    keyword_analysis: {
      required: { text: true, structuredOutput: true },
      preferred: { reasoning: true },
      weights: { jsonReliability: 0.4, reasoning: 0.3, speed: 0.3 },
    },
    detail_generation: {
      required: { text: true },
      preferred: { longContext: true, reasoning: true },
      weights: { writingQuality: 0.45, longContext: 0.25, reasoning: 0.3 },
    },
    faq_generation: {
      required: { text: true },
      preferred: { reasoning: true },
      weights: { writingQuality: 0.5, reasoning: 0.3, speed: 0.2 },
    },
    geo_generation: {
      required: { text: true },
      preferred: { reasoning: true },
      weights: { writingQuality: 0.45, reasoning: 0.35, jsonReliability: 0.2 },
    },
    translation: {
      required: { text: true },
      preferred: { translation: true },
      weights: { translationQuality: 0.45, speed: 0.3, cost: 0.25 },
    },
    schema_repair: {
      required: { structuredOutput: true, text: true },
      preferred: {},
      weights: { jsonReliability: 0.55, speed: 0.3, structuredOutput: 0.15 },
    },
    connection_test: {
      required: { text: true },
      preferred: { structuredOutput: true },
      weights: { speed: 0.5, cost: 0.4, reliability: 0.1 },
    },
    model_list: {
      required: {},
      preferred: {},
      weights: { speed: 1 },
    },
    raw_json: {
      required: { structuredOutput: true, text: true },
      preferred: {},
      weights: { jsonReliability: 0.7, speed: 0.3 },
    },
  }

  function get(task) {
    return PROFILES[task] || PROFILES.product_diagnosis
  }

  function requiredFor(task, context) {
    const profile = get(task)
    const required = Object.assign({}, profile.required)
    const ctx = context || {}
    const imageTask = task === 'product_diagnosis' || task === 'product_identity' || task === 'vision_analysis'
    if (imageTask && ctx.hasImages) required.vision = true
    return required
  }

  ns.taskProfiles = {
    PROFILES: PROFILES,
    get: get,
    requiredFor: requiredFor,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
