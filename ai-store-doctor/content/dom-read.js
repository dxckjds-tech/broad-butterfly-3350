;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.content = ns.content || {}

  function clean(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))]
  }

  function fieldValue(el) {
    if (!el) return ''
    const tag = String(el.tagName || '').toUpperCase()
    if (tag === 'SELECT') {
      return clean(
        Array.from(el.selectedOptions || [])
          .map(function (opt) {
            return opt.textContent
          })
          .join(', '),
      )
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (/checkbox|radio/i.test(el.type)) return el.checked ? clean(el.value || '已选择') : ''
      return clean(el.value)
    }
    return clean(el.textContent)
  }

  function documents() {
    const result = [document]
    const visit = function (doc) {
      Array.from(doc.querySelectorAll('iframe,frame')).forEach(function (frame) {
        try {
          const child = frame.contentDocument
          if (child && result.indexOf(child) === -1) {
            result.push(child)
            visit(child)
          }
        } catch (e) {
          /* cross-origin frame */
        }
      })
    }
    visit(document)
    return result
  }

  function isVisible(el) {
    if (!el) return false
    if (el.closest('[hidden], .hidden, [aria-hidden="true"]')) return false
    const win = el.ownerDocument && el.ownerDocument.defaultView
    if (win) {
      const style = win.getComputedStyle(el)
      if (!style) return true
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
    }
    if (typeof el.getBoundingClientRect === 'function') {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0 && (el.offsetWidth || 0) === 0) return false
    }
    return true
  }

  function looksLikeLoginContext(el) {
    const form = el.closest('form,section,article,div')
    const hay = [
      el.name,
      el.id,
      el.className,
      el.getAttribute('placeholder'),
      form && form.id,
      form && form.className,
      form && form.getAttribute('action'),
      form && form.textContent,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return /login|sign[\s-]?in|signin|passport|auth|登录|登陆/.test(hay)
  }

  function hasProductEditContent(bundle) {
    const product = bundle && bundle.product
    if (!product) return false
    return !!(
      product.name &&
      (product.keywords.length ||
        product.specifications.length ||
        product.sku ||
        product.description ||
        product.attributes.length)
    )
  }

  function detectLoginRequired(bundle) {
    if (hasProductEditContent(bundle)) return false
    const docs = documents()
    for (let i = 0; i < docs.length; i += 1) {
      const passwords = Array.from(docs[i].querySelectorAll('input[type="password"]'))
      for (let j = 0; j < passwords.length; j += 1) {
        const input = passwords[j]
        if (!isVisible(input)) continue
        if (looksLikeLoginContext(input)) return true
      }
    }
    const path = String((location && location.pathname) || '') + String((location && location.search) || '')
    if (/\/(login|signin|passport)\b/i.test(path) && !(bundle && bundle.product && bundle.product.name)) return true
    return false
  }

  const ROOT_SELECTORS = [
    '#productForm',
    'form.product-main',
    'form[id*="product" i]',
    'form[class*="product" i]',
    '.product-main',
    '[class*="product-detail" i]',
    '[class*="prod-detail" i]',
    'article.main-content',
    'main.product-main',
    'main',
    '[role="main"]',
    '#content',
    '.main-content',
    'form',
  ]

  function findProductRoot(doc) {
    for (let i = 0; i < ROOT_SELECTORS.length; i += 1) {
      const el = doc.querySelector(ROOT_SELECTORS[i])
      if (el && el !== doc.body && el !== doc.documentElement) return el
    }
    return null
  }

  function looksLikeProductList(root) {
    if (!root) return false
    const heading = root.querySelector('h1,h2')
    if (heading && /列表|list|catalog|search results/i.test(heading.textContent || '')) return true
    const headers = Array.from(root.querySelectorAll('th')).map(function (th) {
      return clean(th.textContent)
    })
    if (headers.indexOf('操作') !== -1 || headers.indexOf('状态') !== -1) return true
    if (root.querySelector('aside') && /草稿|已发布|全部商品/.test(root.textContent || '')) return true
    return false
  }

  function firstMatch(root, selectors) {
    if (!root) return null
    for (let i = 0; i < selectors.length; i += 1) {
      const el = root.querySelector(selectors[i])
      if (el) return el
    }
    return null
  }

  function allMatch(root, selectors) {
    if (!root) return []
    return unique(
      selectors.flatMap(function (selector) {
        try {
          return Array.from(root.querySelectorAll(selector))
        } catch (e) {
          return []
        }
      }),
    )
  }

  function collectImageMeta(doc, productRoot, titleEl) {
    return Array.from(doc.images || [])
      .map(function (img) {
        const parent = img.parentElement
        const naturalW = img.naturalWidth || 0
        const naturalH = img.naturalHeight || 0
        const w = img.width || naturalW
        const h = img.height || naturalH
        let titleDistance = null
        let nearProductTitle = false
        if (titleEl && typeof img.getBoundingClientRect === 'function') {
          const a = img.getBoundingClientRect()
          const b = titleEl.getBoundingClientRect()
          titleDistance = Math.round(Math.hypot(a.top - b.top, a.left - b.left))
          nearProductTitle = titleDistance < 480
        }
        return {
          src: img.currentSrc || img.src || '',
          alt: img.alt || '',
          width: w || 0,
          height: h || 0,
          naturalWidth: naturalW,
          naturalHeight: naturalH,
          area: (naturalW || w) * (naturalH || h),
          className: String(img.className || ''),
          id: img.id || '',
          parentTag: parent ? parent.tagName : '',
          parentClass: parent ? String(parent.className || '') : '',
          insideProductRoot: !!(productRoot && productRoot.contains(img)),
          insideHeader: !!img.closest('header,[class*="header" i]'),
          insideFooter: !!img.closest('footer,[class*="footer" i]'),
          insideNav: !!img.closest('nav,[class*="nav" i],[class*="site-nav" i]'),
          nearProductTitle: nearProductTitle,
          titleDistance: titleDistance,
        }
      })
      .filter(function (item) {
        return !!item.src
      })
  }

  ns.content.dom = {
    clean,
    unique,
    fieldValue,
    documents,
    isVisible,
    detectLoginRequired,
    findProductRoot,
    looksLikeProductList,
    firstMatch,
    allMatch,
    collectImageMeta,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
