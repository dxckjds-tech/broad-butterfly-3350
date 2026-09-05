/**
 * Exact copy of v1.5.1 ANALYZE_PRODUCT compactFields assembly.
 * Used by the regression runner so Step 0 baselines can be generated
 * before payload-builder.js exists. After Step 2, run-regression.mjs
 * prefers ASD.bg.payloadBuilder.compactFields when available.
 */
export const IMAGE_FILE_PATTERN = /(?:https?:\/\/\S+|[\w%()+,.@-]+)\.(?:jpe?g|png|gif|webp|bmp|svg|avif)(?:\?\S*)?/gi

export function stripImageNames(value) {
  return String(value || '')
    .replace(IMAGE_FILE_PATTERN, '[图片内容由视觉模型单独识别]')
    .replace(/C:\\fakepath\\[^\s,;]+/gi, '[已移除图片文件名]')
}

export function cleanEvidenceRows(rows) {
  return (rows || [])
    .map(stripImageNames)
    .filter((row) => !/^[^：:]{0,30}[：:]\s*\[(?:图片内容|已移除图片文件名)/.test(row))
}

export function compactFields(source) {
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
