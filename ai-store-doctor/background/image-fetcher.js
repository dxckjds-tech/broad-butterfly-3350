;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.bg = ns.bg || {}

  async function imageAsDataUrl(imageUrl) {
    try {
      const url = new URL(imageUrl)
      const supported =
        url.protocol === 'https:' && (url.hostname.endsWith('.made-in-china.com') || url.hostname.endsWith('.vemic.com'))
      if (!supported) return imageUrl
      const response = await fetch(url.href, { credentials: 'include', cache: 'force-cache' })
      if (!response.ok) return imageUrl
      const blob = await response.blob()
      if (!blob.type.startsWith('image/') || blob.size > 2500000) return imageUrl
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (let offset = 0; offset < bytes.length; offset += 32768)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
      return `data:${blob.type};base64,${btoa(binary)}`
    } catch {
      return imageUrl
    }
  }

  ns.bg.imageFetcher = { imageAsDataUrl }
})(typeof globalThis !== 'undefined' ? globalThis : self)
