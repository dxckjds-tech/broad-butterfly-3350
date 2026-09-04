;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const IMAGE_FILE_PATTERN = /(?:https?:\/\/\S+|[\w%()+,.@-]+)\.(?:jpe?g|png|gif|webp|bmp|svg|avif)(?:\?\S*)?/gi

  function stripImageNames(value) {
    return String(value || '')
      .replace(IMAGE_FILE_PATTERN, '[图片内容由视觉模型单独识别]')
      .replace(/C:\\fakepath\\[^\s,;]+/gi, '[已移除图片文件名]')
  }

  function cleanEvidenceRows(rows) {
    return (rows || [])
      .map(stripImageNames)
      .filter((row) => !/^[^：:]{0,30}[：:]\s*\[(?:图片内容|已移除图片文件名)/.test(row))
  }

  function sanitizeModelEvidence(result) {
    if (!result || typeof result !== 'object') return result
    const hasFileName = (value) =>
      /\.(?:jpe?g|png|gif|webp|bmp|svg|avif)(?:\?|\b)/i.test(String(value || '')) ||
      /图片文件名|image filename/i.test(String(value || ''))
    for (const candidate of result.identityCandidates || []) {
      candidate.support = (candidate.support || []).filter((item) => !hasFileName(item))
      candidate.oppose = (candidate.oppose || []).filter((item) => !hasFileName(item))
    }
    return result
  }

  function compactFields(source) {
    const compact = {
      title: stripImageNames(source.title),
      category: stripImageNames(source.category),
      keywords: cleanEvidenceRows(source.keywords),
      specs: cleanEvidenceRows(source.specs).slice(0, 120),
      formFields: cleanEvidenceRows(source.formFields).slice(0, 120),
      certifications: cleanEvidenceRows(source.certifications),
      description: stripImageNames(source.description).slice(0, 5000),
      sku: stripImageNames(source.sku),
      brand: stripImageNames(source.brand),
      companyName: stripImageNames(source.companyName),
      companyProfile: stripImageNames(source.companyProfile).slice(0, 6000),
      visibleText: stripImageNames(source.visibleText).slice(0, 15000),
      imageCount: (source.images || []).length,
      frameCount: source.frameCount,
      url: source.url,
    }
    compact.userConfirmedIdentity = source.userConfirmedIdentity || null
    return compact
  }

  ns.bg.payloadBuilder = {
    stripImageNames,
    cleanEvidenceRows,
    sanitizeModelEvidence,
    compactFields,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
