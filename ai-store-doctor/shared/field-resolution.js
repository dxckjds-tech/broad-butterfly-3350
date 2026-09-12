;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  const HIDDEN_ALLOW = /^(cat|category|class|industry|spu|sku|model|brand|unit|currency|catname|catcode|catename|prodcatname|categoryname|categoryid|cateid)$/i
  const HIDDEN_DENY = /token|session|csrf|user|account|auth|password|secret/i
  const DATA_JSON_ALLOW = /^(data-product|data-page|data-form|data-initial)$/i
  const MAX_ANCESTOR = 4
  const MAX_ROW_TEXT = 120
  const MAX_HIDDEN_LEN = 120

  function prov() {
    return ns.fieldProvenance || {}
  }

  function clean(value) {
    if (ns.content && ns.content.dom && typeof ns.content.dom.clean === 'function') return ns.content.dom.clean(value)
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function fieldValue(el) {
    if (ns.content && ns.content.dom && typeof ns.content.dom.fieldValue === 'function') return ns.content.dom.fieldValue(el)
    if (!el) return ''
    const tag = String(el.tagName || '').toUpperCase()
    if (tag === 'INPUT' || tag === 'TEXTAREA') return clean(el.value)
    if (tag === 'SELECT') {
      return clean(
        Array.from(el.selectedOptions || [])
          .map(function (opt) {
            return opt.textContent
          })
          .join(', '),
      )
    }
    return clean(el.textContent)
  }

  function isWeakTitle(value) {
    const text = clean(value)
    if (!text || text.length < 2) return true
    return /^(编辑|发布|添加)?(商品|产品|产品信息|商品信息)?$|^(编辑商品|发布产品|添加产品|product\s*edit|edit\s*product)$/i.test(text)
  }

  function isWeakCategory(value) {
    const text = clean(value)
    if (!text) return true
    return /^(请选择|选择分类|选择目录|select|n\/?a|-)$/i.test(text)
  }

  function isWeak(field, value) {
    if (field === 'category') return isWeakCategory(value)
    if (field === 'title' || field === 'productName' || field === 'name') return isWeakTitle(value)
    return !clean(value)
  }

  function hit(partial) {
    if (prov().hit) return prov().hit(partial)
    return partial
  }

  function empty() {
    return prov().emptyHit ? prov().emptyHit() : { value: '', confidence: 0, candidates: [] }
  }

  function firstFilled(root, selectors) {
    if (!root) return { el: null, selector: null, value: '' }
    const list = selectors || []
    for (let i = 0; i < list.length; i += 1) {
      try {
        const el = root.querySelector(list[i])
        const value = fieldValue(el)
        if (el && value) return { el: el, selector: list[i], value: value }
      } catch (e) {
        /* invalid selector */
      }
    }
    return { el: null, selector: null, value: '' }
  }

  function semanticName(el) {
    if (!el) return ''
    return [el.getAttribute && el.getAttribute('name'), el.id, el.getAttribute && el.getAttribute('aria-label')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  }

  function matchesFieldSemantics(el, field) {
    const hay = semanticName(el)
    if (!hay) return false
    if (field === 'title' || field === 'productName' || field === 'name') {
      return /prodname|productname|goodsname|goodname|enname|comname|subject|title/.test(hay)
    }
    if (field === 'category') return /catname|category|cate|catalogue|catcode|industry/.test(hay)
    if (field === 'keywords') return /keyword|searchterm/.test(hay)
    if (field === 'description') return /desc|detail|content/.test(hay)
    return hay.indexOf(String(field).toLowerCase()) !== -1
  }

  function explicitForm(root, field) {
    if (!root) return empty()
    const controls = Array.from(root.querySelectorAll('input,textarea,select'))
    for (let i = 0; i < controls.length; i += 1) {
      const el = controls[i]
      if (String(el.type || '').toLowerCase() === 'hidden') continue
      if (!matchesFieldSemantics(el, field)) continue
      const value = fieldValue(el)
      if (value && !isWeak(field, value)) {
        return hit({
          value: value,
          tier: 'EXPLICIT_FORM',
          strategy: 'T1_EXPLICIT_FORM',
          confidence: 96,
          selector: el.name ? (el.tagName.toLowerCase() + '[name="' + el.name + '"]') : el.id ? '#' + el.id : null,
          sourceType: 'explicit_form',
          sourceRef: el.name || el.id || '',
          candidates: [value],
        })
      }
    }
    return empty()
  }

  function ancestorText(el, depth) {
    let node = el
    let steps = 0
    while (node && steps < depth) {
      const label = node.closest && node.closest('label')
      if (label) return clean(String(label.textContent || '').replace(fieldValue(el), ''))
      node = node.parentElement
      steps += 1
    }
    return ''
  }

  function rowPrefixText(el) {
    const row = el.closest && el.closest('tr,.form-item,.form-group,.field,li')
    if (!row) return ''
    const text = clean(String(row.textContent || '').replace(fieldValue(el), ''))
    return text.length <= MAX_ROW_TEXT ? text : ''
  }

  function previousSiblingText(el) {
    let sib = el.previousElementSibling
    let hops = 0
    while (sib && hops < 3) {
      const text = clean(sib.textContent)
      if (text && text.length <= MAX_ROW_TEXT) return text
      sib = sib.previousElementSibling
      hops += 1
    }
    return ''
  }

  function controlFromLabel(root, label) {
    if (!label) return null
    if (label.control && root.contains(label.control)) return label.control
    const htmlFor = label.getAttribute && label.getAttribute('for')
    if (htmlFor) {
      try {
        const linked = root.querySelector('#' + CSS.escape(htmlFor))
        if (linked) return linked
      } catch (e) {
        const fallback = root.querySelector('[id="' + htmlFor + '"]')
        if (fallback) return fallback
      }
    }
    const nested = label.querySelector && label.querySelector('input,textarea,select,.cate-selected,.selected-category')
    if (nested) return nested
    let sib = label.nextElementSibling
    let hops = 0
    while (sib && hops < 4) {
      if (/^(INPUT|TEXTAREA|SELECT)$/i.test(sib.tagName)) return sib
      const child = sib.querySelector && sib.querySelector('input,textarea,select,.cate-selected,.selected-category,[class*="selected-cate" i]')
      if (child) return child
      if (sib.matches && sib.matches('.cate-selected,.selected-category,[class*="selected-cate" i]')) return sib
      sib = sib.nextElementSibling
      hops += 1
    }
    const group = label.closest && label.closest('.form-item,.form-group,.field,tr,li')
    if (group && group !== root && hops < MAX_ANCESTOR) {
      return group.querySelector('input,textarea,select,.cate-selected,.selected-category,[class*="selected-cate" i]') || null
    }
    return null
  }

  function labelAnchored(root, field) {
    if (!root) return empty()
    const dict = ns.content && ns.content.labelDict
    const nodes = Array.from(root.querySelectorAll('label,.form-label,.field-label,th,dt,[class*="label" i]'))
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const nested = node.querySelector && node.querySelector('input,textarea,select')
      const text = clean(String(node.textContent || '').replace(fieldValue(nested), ''))
      if (!text || text.length > MAX_ROW_TEXT) continue
      const matched = dict ? dict.matchLabel(text, field) : false
      if (!matched) continue
      const el = controlFromLabel(root, node)
      const value = fieldValue(el)
      if (el && value && !isWeak(field, value)) {
        return hit({
          value: value,
          tier: 'LABEL_ANCHORED',
          strategy: 'T2_LABEL_ANCHORED',
          confidence: 92,
          selector: 'label:' + text,
          sourceType: 'explicit_page_field',
          sourceRef: text,
          candidates: [value],
        })
      }
    }
    const controls = Array.from(root.querySelectorAll('input,textarea,select,.cate-selected'))
    for (let j = 0; j < controls.length; j += 1) {
      const el = controls[j]
      const hints = [
        el.getAttribute && el.getAttribute('aria-label'),
        el.getAttribute && el.getAttribute('placeholder'),
        ancestorText(el, MAX_ANCESTOR),
        rowPrefixText(el),
        previousSiblingText(el),
      ]
      for (let k = 0; k < hints.length; k += 1) {
        if (dict && dict.matchLabel(hints[k], field)) {
          const value = fieldValue(el)
          if (value && !isWeak(field, value)) {
            return hit({
              value: value,
              tier: 'LABEL_ANCHORED',
              strategy: 'T2_LABEL_ANCHORED',
              confidence: 88,
              selector: 'label:' + hints[k],
              sourceType: 'explicit_page_field',
              sourceRef: hints[k],
              candidates: [value],
            })
          }
        }
      }
    }
    return empty()
  }

  function hiddenAllowed(el) {
    if (!el || String(el.type || '').toLowerCase() !== 'hidden') return false
    const name = String(el.name || el.id || '')
    if (!name || HIDDEN_DENY.test(name)) return false
    if (!HIDDEN_ALLOW.test(name.replace(/[_-]/g, ''))) return false
    const value = clean(el.value)
    if (!value || value.length > MAX_HIDDEN_LEN) return false
    if (/[{}\[\]<>]|bearer |sk-/.test(value)) return false
    return true
  }

  function walkKeys(obj, keys, depth) {
    if (!obj || typeof obj !== 'object' || depth > 6) return { value: '', key: '' }
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]
      if (typeof obj[key] === 'string' && obj[key].trim()) return { value: obj[key].trim(), key: key }
      if (obj[key] && typeof obj[key] === 'object' && typeof obj[key].name === 'string' && obj[key].name.trim()) {
        return { value: obj[key].name.trim(), key: key + '.name' }
      }
    }
    const children = Array.isArray(obj) ? obj : Object.keys(obj).map(function (k) { return obj[k] })
    for (let j = 0; j < children.length; j += 1) {
      const found = walkKeys(children[j], keys, depth + 1)
      if (found.value) return found
    }
    return { value: '', key: '' }
  }

  function collectAllowedScripts(doc) {
    const blobs = []
    if (!doc) return blobs
    Array.from(doc.querySelectorAll('script[type="application/json"]')).forEach(function (script) {
      try {
        blobs.push({ data: JSON.parse(script.textContent), ref: 'script[type=application/json]' })
      } catch (e) {
        /* ignore */
      }
    })
    Array.from(doc.querySelectorAll('[data-product],[data-page],[data-form],[data-initial]')).forEach(function (el) {
      Array.from(el.attributes || []).forEach(function (attr) {
        if (!DATA_JSON_ALLOW.test(attr.name)) return
        try {
          blobs.push({ data: JSON.parse(attr.value), ref: attr.name })
        } catch (e2) {
          /* ignore */
        }
      })
    })
    return blobs
  }

  function structuredScript(doc, keys) {
    const blobs = collectAllowedScripts(doc)
    for (let i = 0; i < blobs.length; i += 1) {
      const found = walkKeys(blobs[i].data, keys, 0)
      if (found.value) {
        return hit({
          value: clean(found.value),
          tier: 'STRUCTURED_SCRIPT',
          strategy: 'T3_STRUCTURED_SCRIPT',
          confidence: 86,
          selector: 'json:' + found.key,
          sourceType: 'explicit_page_field',
          sourceRef: blobs[i].ref + ':' + found.key,
          candidates: [found.value],
        })
      }
    }
    return empty()
  }

  function jsonLd(doc, field) {
    if (!doc) return empty()
    const nodes = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    for (let i = 0; i < nodes.length; i += 1) {
      try {
        const value = JSON.parse(nodes[i].textContent)
        const items = Array.isArray(value) ? value : [value]
        for (let j = 0; j < items.length; j += 1) {
          const item = items[j]
          const type = item && item['@type']
          const isProduct = type === 'Product' || (Array.isArray(type) && type.indexOf('Product') !== -1)
          if (!isProduct) continue
          if ((field === 'title' || field === 'productName' || field === 'name') && item.name) {
            return hit({
              value: clean(item.name),
              tier: 'JSON_LD',
              strategy: 'T4_JSON_LD',
              confidence: 90,
              selector: 'jsonld:name',
              sourceType: 'json_ld',
              sourceRef: 'jsonld:name',
              candidates: [item.name],
            })
          }
          if (field === 'category' && item.category) {
            return hit({
              value: clean(typeof item.category === 'string' ? item.category : item.category.name),
              tier: 'JSON_LD',
              strategy: 'T4_JSON_LD',
              confidence: 88,
              selector: 'jsonld:category',
              sourceType: 'json_ld',
              sourceRef: 'jsonld:category',
              candidates: [],
            })
          }
        }
      } catch (e) {
        /* ignore */
      }
    }
    return empty()
  }

  function pairedIdText(root, field) {
    if (field !== 'category' || !root) return empty()
    const idEl = Array.from(root.querySelectorAll('input')).find(function (el) {
      return hiddenAllowed(el) && /cat|class|industry/i.test(el.name || el.id || '')
    })
    const textHit = firstFilled(root, ['.cate-selected', '.selected-category', '[class*="cate-selected" i]', '[class*="category-path" i]'])
    if (!textHit.value && !idEl) return empty()
    const idVal = idEl ? clean(idEl.value) : ''
    const path = textHit.value || ''
    if (!path && !idVal) return empty()
    return hit({
      value: path || idVal,
      path: path,
      id: idVal,
      tier: 'PAIRED_ID_TEXT',
      strategy: 'T5_PAIRED_ID_TEXT',
      confidence: path && idVal ? 94 : 80,
      selector: textHit.selector || (idEl && idEl.name),
      sourceType: 'paired_id_text',
      sourceRef: (idEl && (idEl.name || idEl.id)) || textHit.selector || '',
      candidates: [path, idVal].filter(Boolean),
    })
  }

  function semanticDom(root, selectors, field) {
    const found = firstFilled(root, selectors || [])
    if (!found.value || isWeak(field, found.value)) return empty()
    return hit({
      value: found.value,
      tier: 'SEMANTIC_DOM',
      strategy: 'T6_SEMANTIC_DOM',
      confidence: 62,
      selector: found.selector,
      sourceType: 'semantic_dom',
      sourceRef: found.selector || '',
      candidates: [found.value],
    })
  }

  function specRow(root, field) {
    if (!root) return empty()
    const rows = Array.from(root.querySelectorAll('table tr'))
    const dict = ns.content && ns.content.labelDict
    for (let i = 0; i < rows.length; i += 1) {
      const cells = Array.from(rows[i].querySelectorAll('th,td')).map(function (cell) {
        return clean(cell.textContent)
      })
      if (cells.length < 2) continue
      if (dict && dict.matchLabel(cells[0], field)) {
        return hit({
          value: cells[1],
          tier: 'SPEC_ROW',
          strategy: 'T7_SPEC_ROW',
          confidence: 90,
          selector: 'table tr',
          sourceType: 'spec_table',
          sourceRef: cells[0],
          candidates: [cells[1]],
        })
      }
    }
    return empty()
  }

  function fallback(root, selectors, field) {
    const found = firstFilled(root, selectors || [])
    if (!found.value || isWeak(field, found.value)) return empty()
    return hit({
      value: found.value,
      tier: 'FALLBACK',
      strategy: 'T8_FALLBACK',
      confidence: 40,
      selector: found.selector,
      sourceType: 'fallback',
      sourceRef: found.selector || '',
      candidates: [found.value],
    })
  }

  function resolveField(root, doc, field, options) {
    const opts = options || {}
    const map = opts.map || {}
    const profile = opts.profile || 'generic'
    const selectors = map[field] || []
    const jsonKeys = opts.jsonKeys || []
    const skipFrontend = profile === 'mic-membercenter-edit'
    const frontend = skipFrontend ? [] : opts.frontendSelectors || []
    const steps = []

    function take(result) {
      if (result && result.value) {
        steps.push(result)
        return result
      }
      return null
    }

    const t1 = take(explicitForm(root, field))
    if (t1) return t1
    const t2 = take(labelAnchored(root, field))
    if (t2) return t2
    if (field === 'category') {
      const t5 = take(pairedIdText(root, field))
      if (t5) return t5
    }
    const t3 = take(structuredScript(doc, jsonKeys))
    if (t3) return t3
    const t4 = take(jsonLd(doc, field))
    if (t4) return t4
    const t7 = take(specRow(root, field))
    if (t7) return t7
    if (!skipFrontend) {
      const t6 = take(semanticDom(root, frontend.length ? frontend : selectors, field))
      if (t6) return t6
    }
    return take(fallback(root, selectors, field)) || empty()
  }

  ns.fieldResolution = {
    resolveField: resolveField,
    explicitForm: explicitForm,
    labelAnchored: labelAnchored,
    structuredScript: structuredScript,
    jsonLd: jsonLd,
    pairedIdText: pairedIdText,
    hiddenAllowed: hiddenAllowed,
    isWeakTitle: isWeakTitle,
    isWeakCategory: isWeakCategory,
    firstFilled: firstFilled,
    HIDDEN_ALLOW: HIDDEN_ALLOW,
    HIDDEN_DENY: HIDDEN_DENY,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
