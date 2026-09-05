;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  const MAX_ONE = 1.5 * 1024 * 1024
  const MAX_ALL = 4 * 1024 * 1024
  const DENY = /cert(?:ificate)?|license|qualification|avatar|\/order|invoice/i

  function isAllowedHost(hostname) {
    return ASD.constants && ASD.constants.isSupportedHost
      ? ASD.constants.isSupportedHost(hostname)
      : false
  }

  function mayIncludeCredentials(url, score) {
    return (
      (score || 0) >= 40 &&
      url.protocol === 'https:' &&
      isAllowedHost(url.hostname) &&
      !DENY.test(url.pathname + url.search)
    )
  }

  async function imageAsDataUrl(imageUrl, options) {
    options = options || {}
    try {
      const url = new URL(imageUrl)
      if (url.protocol !== 'https:' || !isAllowedHost(url.hostname)) return null
      if (DENY.test(url.pathname + url.search)) return null
      const init = { cache: 'force-cache' }
      if (options.allowCredentials && mayIncludeCredentials(url, options.score)) init.credentials = 'include'
      const response = await fetch(url.href, init)
      if (!response.ok) return null
      const blob = await response.blob()
      if (!blob.type.startsWith('image/') || blob.size > MAX_ONE) return null
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (let offset = 0; offset < bytes.length; offset += 32768)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
      return `data:${blob.type};base64,${btoa(binary)}`
    } catch (e) {
      return null
    }
  }

  function estimateBytes(dataUrl) {
    if (!dataUrl || dataUrl.indexOf('data:') !== 0) return 0
    const comma = dataUrl.indexOf(',')
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : ''
    return Math.floor((b64.length * 3) / 4)
  }

  async function fetchVisionImages(images, options) {
    const limit = options && options.limit != null ? Math.max(0, Number(options.limit) || 0) : 5
    const ranked = ASD.imageScore ? ASD.imageScore.topN(images || [], limit) : (images || []).slice(0, limit)
    const picked = []
    let total = 0
    for (let i = 0; i < ranked.length; i += 1) {
      const img = ranked[i]
      const data = await imageAsDataUrl(img.src, {
        allowCredentials: true,
        score: img.score || 0,
      })
      if (!data || data.indexOf('data:image/') !== 0) continue
      const bytes = estimateBytes(data)
      if (bytes > MAX_ONE) continue
      if (total + bytes > MAX_ALL) break
      total += bytes
      picked.push({ originalSrc: img.src, dataUrl: data, score: img.score || 0 })
    }
    return { urls: picked.map(function (item) { return item.dataUrl }), picked: picked, ranked: ranked }
  }

  ns.bg.imageFetcher = { imageAsDataUrl, fetchVisionImages, MAX_ONE, MAX_ALL }
})(typeof globalThis !== 'undefined' ? globalThis : self)
