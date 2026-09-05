;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.content = ns.content || {}

  const SPEC_PATTERNS = [
    { key: 'capacity', re: /capacity|容量|容积/i },
    { key: 'voltage', re: /voltage|电压/i },
    { key: 'power', re: /(?:^|[\s：:])(?:rated\s+)?power|功率|watt/i },
    { key: 'size', re: /size|尺寸|规格型号|dn\b/i },
    { key: 'material', re: /material|材质|shell material|材料/i },
    { key: 'model', re: /model|型号/i },
    { key: 'sku', re: /^(?:sku|mpn)\b/i },
    { key: 'price', re: /price|价格|fob/i },
    { key: 'moq', re: /moq|min(?:imum)?\s*order|起订/i },
    { key: 'packaging', re: /packag|包装/i },
    { key: 'deliveryTime', re: /deliver|lead time|交货/i },
  ]

  function clean(value) {
    return ns.content.dom.clean(value)
  }

  function unique(values) {
    return ns.content.dom.unique(values)
  }

  function parseJsonLd(doc) {
    return Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).flatMap(function (node) {
      try {
        const value = JSON.parse(node.textContent)
        return Array.isArray(value) ? value : [value]
      } catch (e) {
        return []
      }
    })
  }

  function isProductType(item) {
    if (!item) return false
    if (item['@type'] === 'Product') return true
    return Array.isArray(item['@type']) && item['@type'].indexOf('Product') !== -1
  }

  function splitPair(row) {
    const text = clean(row)
    const idx = text.search(/[：:]/)
    if (idx < 1) return null
    return { name: clean(text.slice(0, idx)), value: clean(text.slice(idx + 1)) }
  }

  function rowsFromRoot(root) {
    if (!root) return []
    const tableRows = Array.from(root.querySelectorAll('table tr'))
      .map(function (row) {
        return Array.from(row.querySelectorAll('th,td'))
          .map(function (cell) {
            return clean(cell.textContent)
          })
          .filter(Boolean)
      })
      .filter(function (cells) {
        return cells.length >= 2 && cells.length <= 10
      })
      .map(function (cells) {
        return cells.join('：')
      })
    const definitions = Array.from(root.querySelectorAll('dt'))
      .map(function (dt) {
        return dt.nextElementSibling && dt.nextElementSibling.tagName === 'DD'
          ? clean(dt.textContent) + '：' + clean(dt.nextElementSibling.textContent)
          : ''
      })
      .filter(Boolean)
    return unique(tableRows.concat(definitions))
  }

  function applySpecRow(product, name, value) {
    if (!name || !value) return
    const pair = { name: name, value: value }
    const exists = product.specifications.some(function (item) {
      return item.name === name && item.value === value
    })
    if (!exists) product.specifications.push(pair)
    for (let i = 0; i < SPEC_PATTERNS.length; i += 1) {
      if (SPEC_PATTERNS[i].re.test(name) && !product[SPEC_PATTERNS[i].key]) {
        product[SPEC_PATTERNS[i].key] = value
      }
    }
    if (/application|应用|适用/i.test(name)) {
      value.split(/[,，;/]/).forEach(function (part) {
        const item = clean(part)
        if (item && product.applications.indexOf(item) === -1) product.applications.push(item)
      })
    }
  }

  function emptyHits() {
    return {
      title: null,
      category: null,
      keywords: null,
      description: null,
      specifications: null,
      company: null,
      productRoot: null,
    }
  }

  function readMapped(root, map, key, hits) {
    const hit = ns.content.dom.firstMatchHit(root, map[key] || [])
    if (hits) hits[key] = hit.selector
    return hit.el ? ns.content.dom.fieldValue(hit.el) : ''
  }

  function readMappedList(root, map, key) {
    return unique(
      ns.content.dom.allMatch(root, map[key] || []).flatMap(function (el) {
        return ns.content.dom
          .fieldValue(el)
          .split(/[,，;；\n]/)
          .map(clean)
      }),
    ).filter(Boolean)
  }

  function extractOne(doc) {
    const bundle = ns.productFields.emptyBundle()
    const hostname = (function () {
      try {
        return (doc && doc.defaultView && doc.defaultView.location && doc.defaultView.location.hostname) || location.hostname
      } catch (e) {
        return location.hostname
      }
    })()
    const pathname = (function () {
      try {
        return (doc && doc.defaultView && doc.defaultView.location && doc.defaultView.location.pathname) || location.pathname
      } catch (e2) {
        return location.pathname
      }
    })()
    const profileInfo =
      ns.content.fieldMap && typeof ns.content.fieldMap.detectPageProfile === 'function'
        ? ns.content.fieldMap.detectPageProfile(hostname, pathname)
        : { id: ns.content.fieldMap.detectSite(hostname), family: ns.content.fieldMap.detectSite(hostname) }
    const site = profileInfo.family || profileInfo.id
    const profile = profileInfo.id || site
    const map = ns.content.fieldMap.mapFor(profile)
    bundle.debug.site = site
    bundle.debug.pageProfile = profile

    const hits = emptyHits()
    bundle.debug.selectorHits = hits
    const rootHit = ns.content.dom.findProductRootHit(doc)
    const root = rootHit.el
    hits.productRoot = rootHit.selector
    bundle.debug.productRootFound = !!root
    if (!root) {
      bundle.debug.degraded = true
      return bundle
    }

    const listPage = ns.content.dom.looksLikeProductList(root, profile)
    const jsonLd = parseJsonLd(doc)
    const productLd =
      jsonLd.find(isProductType) ||
      {}
    const organizationLd =
      jsonLd.find(function (item) {
        return ['Organization', 'Corporation', 'LocalBusiness'].indexOf(item && item['@type']) !== -1
      }) ||
      productLd.manufacturer ||
      productLd.brand ||
      {}

    const titleResolved =
      ns.content.fieldMap && typeof ns.content.fieldMap.resolveValue === 'function'
        ? ns.content.fieldMap.resolveValue(root, doc, 'title', { map: map, profile: profile, site: profile })
        : { value: '', source: null }
    hits.title = titleResolved.source
    let name = clean(titleResolved.value || (profile === 'mic-membercenter-edit' ? '' : productLd.name))
    if (listPage) name = null
    const titleEl =
      titleResolved.source && titleResolved.source.indexOf('json') !== 0 && titleResolved.source.indexOf('label:') !== 0
        ? ns.content.dom.firstMatch(root, [titleResolved.source])
        : null

    const product = bundle.product
    product.name = name || null
    const categoryResolved =
      ns.content.fieldMap && typeof ns.content.fieldMap.resolveValue === 'function'
        ? ns.content.fieldMap.resolveValue(root, doc, 'category', { map: map, profile: profile, site: profile })
        : { value: '', source: null }
    hits.category = categoryResolved.source
    product.category = categoryResolved.value || null
    if (categoryResolved.hit && (categoryResolved.hit.path || categoryResolved.hit.id)) {
      product.categoryMeta = {
        value: categoryResolved.hit.value || product.category,
        path: categoryResolved.hit.path || categoryResolved.value || '',
        id: categoryResolved.hit.id || '',
        sourceType: categoryResolved.hit.sourceType || '',
        confidence: categoryResolved.hit.confidence || 0,
      }
    }
    product.model = readMapped(root, map, 'model') || clean(productLd.model) || null
    product.brand = readMapped(root, map, 'brand') || clean(typeof productLd.brand === 'string' ? productLd.brand : productLd.brand && productLd.brand.name) || null
    product.sku = readMapped(root, map, 'sku') || clean(productLd.sku || productLd.mpn) || null
    product.keywords = listPage ? [] : readMappedList(root, map, 'keywords')
    hits.keywords = ns.content.dom.firstMatchHit(root, map.keywords || []).selector
    product.price = readMapped(root, map, 'price') || null
    product.moq = readMapped(root, map, 'moq') || null
    const metaDesc = doc.querySelector('meta[name="description"]')
    product.description =
      readMapped(root, map, 'description', hits) || clean(productLd.description || (metaDesc && metaDesc.content)) || null
    product.material = readMapped(root, map, 'material') || null
    product.size = readMapped(root, map, 'size') || null
    product.power = readMapped(root, map, 'power') || null
    product.voltage = readMapped(root, map, 'voltage') || null
    product.capacity = readMapped(root, map, 'capacity') || null
    product.packaging = readMapped(root, map, 'packaging') || null
    product.deliveryTime = readMapped(root, map, 'deliveryTime') || null
    product.certifications = readMappedList(root, map, 'certifications')
    const apps = readMapped(root, map, 'applications')
    if (apps) product.applications = unique(apps.split(/[,，;/]/).map(clean).filter(Boolean))

    if (Array.isArray(productLd.additionalProperty)) {
      productLd.additionalProperty.forEach(function (prop) {
        applySpecRow(product, clean(prop.name || prop.propertyID || '属性'), clean(prop.value))
      })
    }
    rowsFromRoot(root).forEach(function (row) {
      const pair = splitPair(row)
      if (pair) applySpecRow(product, pair.name, pair.value)
      else product.attributes.push({ name: 'note', value: row })
    })
    hits.specifications = ns.content.dom.firstMatchHit(root, map.specifications || []).selector

    const companyHeading = Array.from(root.querySelectorAll('h1,h2,h3,h4,[class*="title" i]')).find(function (el) {
      return /company profile|about us|公司简介|供应商信息/i.test(el.textContent || '')
    })
    const companyBlock =
      (companyHeading && companyHeading.closest('section,article,div')) ||
      ns.content.dom.firstMatch(root, map.companyProfile)
    bundle.company.name =
      readMapped(root, map, 'companyName') || clean(organizationLd.name) || null
    bundle.company.profile = clean((organizationLd && organizationLd.description) || (companyBlock && companyBlock.textContent)).slice(0, 4000) || null
    hits.company =
      ns.content.dom.firstMatchHit(root, map.companyName || []).selector ||
      ns.content.dom.firstMatchHit(root, map.companyProfile || []).selector

    bundle.current.title = product.name
    bundle.current.keywords = product.keywords.slice()
    bundle.current.description = product.description

    const filled = ns.productFields.countProductFields(product)
    const budget = filled >= 8 ? 400 : filled >= 4 ? 800 : 1200
    bundle.fallbackText = clean(root.textContent).slice(0, budget)
    bundle.debug.fallbackProvenance = { bounded: true, maxChars: budget, confidence: 35, sourceType: 'fallback' }
    const rawImages = ns.content.dom.collectImageMeta(doc, root, titleEl)
    const productWords = unique(
      [product.name, product.brand, product.model]
        .concat(product.keywords || [])
        .join(' ')
        .split(/\s+/)
        .filter(function (word) {
          return word && word.length > 2
        }),
    )
    bundle.images = ns.imageScore
      ? ns.imageScore.topN(rawImages, 8, { productWords: productWords })
      : rawImages.slice(0, 8)
    bundle.debug.imageCandidates = (bundle.images || []).map(function (img) {
      return {
        src: ns.imageScore ? ns.imageScore.redactSrc(img.src) : img.src,
        score: img.score || 0,
        reasons: img.reasons || [],
        width: img.width,
        height: img.height,
      }
    })

    const keywordResolved =
      ns.content.fieldMap && typeof ns.content.fieldMap.resolveValue === 'function'
        ? ns.content.fieldMap.resolveValue(root, doc, 'keywords', { map: map, profile: profile, site: profile })
        : { value: '', source: null, hit: null }
    if ((!product.keywords || !product.keywords.length) && keywordResolved.value) {
      product.keywords = unique(
        String(keywordResolved.value)
          .split(/[,，;；\n]/)
          .map(clean)
          .filter(Boolean),
      )
      hits.keywords = keywordResolved.source
    }

    const provenance = {
      productName: titleResolved.hit || { tier: titleResolved.stage, selector: titleResolved.source, confidence: titleResolved.value ? 80 : 0 },
      category: categoryResolved.hit || { tier: categoryResolved.stage, selector: categoryResolved.source, confidence: categoryResolved.value ? 80 : 0 },
      keywords: keywordResolved.hit || { tier: '', selector: hits.keywords, confidence: product.keywords.length ? 70 : 0 },
    }
    bundle.fieldProvenance = ns.fieldProvenance && typeof ns.fieldProvenance.summarize === 'function'
      ? ns.fieldProvenance.summarize(provenance)
      : provenance
    bundle.debug.fieldProvenance = bundle.fieldProvenance

    bundle.debug.completeProduct = !listPage && !!(product.name && (product.keywords.length || product.specifications.length || product.sku || product.description))
    bundle.debug.degraded = listPage || !bundle.debug.completeProduct
    return bundle
  }

  function mergeBundles(parts) {
    if (!parts.length) return ns.productFields.emptyBundle()
    const best = parts.slice().sort(function (a, b) {
      return ns.productFields.countNewFields(b) - ns.productFields.countNewFields(a)
    })[0]
    const merged = JSON.parse(JSON.stringify(best))
    const allImages = parts.flatMap(function (part) {
      if (!merged.debug.productRootFound && part.debug.productRootFound) merged.debug.productRootFound = true
      return part.images || []
    })
    merged.images = ns.imageScore ? ns.imageScore.topN(allImages, 8) : allImages.slice(0, 8)
    merged.debug.imageCandidates = (merged.images || []).map(function (img) {
      return {
        src: ns.imageScore ? ns.imageScore.redactSrc(img.src) : img.src,
        score: img.score || 0,
        reasons: img.reasons || [],
        width: img.width,
        height: img.height,
      }
    })
    return merged
  }

  function extractAll() {
    const parts = ns.content.dom.documents().map(extractOne)
    return mergeBundles(parts)
  }

  ns.content.extractors = { extractOne, extractAll, parseJsonLd }
})(typeof globalThis !== 'undefined' ? globalThis : self)
