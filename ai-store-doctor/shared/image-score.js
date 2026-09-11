;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  function dim(img, axis) {
    if (axis === 'w') return img.naturalWidth || img.width || 0
    return img.naturalHeight || img.height || 0
  }

  function haystack(img) {
    return [img.src, img.alt, img.className, img.id, img.parentClass, img.parentTag]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  }

  function scoreImage(img, ctx) {
    let score = 0
    const reasons = []
    const hay = haystack(img)
    const w = dim(img, 'w')
    const h = dim(img, 'h')

    if (img.insideProductRoot) {
      score += 50
      reasons.push('+50 productRoot')
    }
    if (img.nearProductTitle) {
      score += 28
      reasons.push('+28 nearTitle')
    }
    if (w >= 300) {
      score += 15
      reasons.push('+15 width')
    }
    if (h >= 300) {
      score += 15
      reasons.push('+15 height')
    }
    const words = (ctx && ctx.productWords) || []
    if (img.alt && words.some(function (word) {
      return word && String(img.alt).toLowerCase().indexOf(String(word).toLowerCase()) !== -1
    })) {
      score += 15
      reasons.push('+15 alt')
    }
    if ((img.area || w * h) >= 90000) {
      score += 10
      reasons.push('+10 area')
    }

    if (img.insideHeader) {
      score -= 50
      reasons.push('-50 header')
    }
    if (img.insideFooter) {
      score -= 50
      reasons.push('-50 footer')
    }
    if (img.insideNav) {
      score -= 50
      reasons.push('-50 nav')
    }
    if (/logo/.test(hay)) {
      score -= 60
      reasons.push('-60 logo')
    }
    if (/avatar/.test(hay)) {
      score -= 60
      reasons.push('-60 avatar')
    }
    if (/(?:^|[\s_\-/])icon(?:[\s_\-/]|$)/.test(hay) || /favicon/.test(hay)) {
      score -= 40
      reasons.push('-40 icon')
    }
    if (/banner/.test(hay)) {
      score -= 30
      reasons.push('-30 banner')
    }
    if (w && w < 100) {
      score -= 40
      reasons.push('-40 smallW')
    }
    if (h && h < 100) {
      score -= 40
      reasons.push('-40 smallH')
    }
    if (/cert(?:ificate)?|license|qualification/.test(hay)) {
      score -= 55
      reasons.push('-55 cert')
    }

    return { score: score, reasons: reasons }
  }

  function canonicalSrc(src) {
    try {
      const url = new URL(src, 'https://sample.made-in-china.com')
      url.search = ''
      url.hash = ''
      url.pathname = url.pathname.replace(/_(\d+)x(\d+)(?=\.[a-z]+$)/i, '')
      return url.origin + url.pathname
    } catch (e) {
      return String(src || '').split('?')[0]
    }
  }

  function redactSrc(src) {
    try {
      const url = new URL(src)
      if (/token|key|sid|session|auth|signature/i.test(url.search)) url.search = '?[REDACTED]'
      return url.toString()
    } catch (e) {
      return String(src || '')
    }
  }

  function rank(images, ctx) {
    const scored = (images || []).map(function (img) {
      const judged = scoreImage(img, ctx)
      return Object.assign({}, img, judged)
    })
    const best = new Map()
    scored.forEach(function (img) {
      const key = canonicalSrc(img.src)
      const prev = best.get(key)
      if (!prev || img.score > prev.score) best.set(key, img)
    })
    return Array.from(best.values()).sort(function (a, b) {
      return b.score - a.score
    })
  }

  function topN(images, n, ctx) {
    const ranked = rank(images, ctx)
    const usable = ranked.filter(function (img) {
      return img.score > 0
    })
    return (usable.length ? usable : ranked.slice(0, 1)).slice(0, n)
  }

  ns.imageScore = { scoreImage, canonicalSrc, redactSrc, rank, topN }
})(typeof globalThis !== 'undefined' ? globalThis : self)
