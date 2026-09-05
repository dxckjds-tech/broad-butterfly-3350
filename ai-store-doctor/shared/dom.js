;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  function setAttrs(node, attrs) {
    if (!attrs) return
    Object.keys(attrs).forEach(function (key) {
      const value = attrs[key]
      if (value == null || value === false) return
      if (key === 'text') {
        node.textContent = String(value)
        return
      }
      if (key === 'class' || key === 'className') {
        node.setAttribute('class', String(value))
        return
      }
      if (key.slice(0, 2) === 'on' && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value)
        return
      }
      if (value === true) {
        node.setAttribute(key, '')
        return
      }
      node.setAttribute(key, String(value))
    })
  }

  function append(parent, children) {
    children.flat(Infinity).forEach(function (child) {
      if (child == null || child === false) return
      if (typeof child === 'string' || typeof child === 'number') {
        parent.appendChild(document.createTextNode(String(child)))
        return
      }
      parent.appendChild(child)
    })
  }

  /**
   * Safe element constructor. Never uses innerHTML.
   * Text must go through textContent (attrs.text or string children).
   */
  function el(tag, attrs) {
    const node = document.createElement(tag)
    const rest = Array.prototype.slice.call(arguments, 2)
    if (attrs && attrs.nodeType) {
      append(node, [attrs].concat(rest))
      return node
    }
    setAttrs(node, attrs)
    append(node, rest)
    return node
  }

  function frag() {
    const node = document.createDocumentFragment()
    append(node, Array.prototype.slice.call(arguments))
    return node
  }

  ns.dom = { el, frag }
})(typeof globalThis !== 'undefined' ? globalThis : self)
