;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  ns.taskTypes = {
    CONNECTION_TEST: 'connection_test',
    TRANSLATION: 'translation',
    PRODUCT_DIAGNOSIS: 'product_diagnosis',
    VISION_ANALYSIS: 'vision_analysis',
    MODEL_LIST: 'model_list',
    RAW_JSON: 'raw_json',
    PRODUCT_IDENTITY: 'product_identity',
    FACT_EXTRACTION: 'fact_extraction',
    TITLE_GENERATION: 'title_generation',
    KEYWORD_ANALYSIS: 'keyword_analysis',
    DETAIL_GENERATION: 'detail_generation',
    FAQ_GENERATION: 'faq_generation',
    GEO_GENERATION: 'geo_generation',
    SCHEMA_REPAIR: 'schema_repair',
    EVIDENCE_ANALYSIS: 'evidence_analysis',
    DIAGNOSIS_REASONING: 'diagnosis_reasoning',
    CONTENT_GENERATION: 'content_generation',
    DIAGNOSIS_AND_CONTENT: 'diagnosis_and_content',
    EVIDENCE_AND_DIAGNOSIS: 'evidence_and_diagnosis',
    FACT_VERIFICATION: 'fact_verification',
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
