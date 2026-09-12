;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})
  ns.content = ns.content || {}

  const DICT = {
    productName: [
      '产品名称',
      '商品名称',
      '产品标题',
      '商品标题',
      'Product Name',
      'Product Title',
      'Goods Name',
      'Item Name',
    ],
    category: ['产品类目', '商品类目', '产品分类', '商品分类', '产品目录', '已选分类', 'Category', 'Product Category', 'Catalogue'],
    keywords: ['关键词', '产品关键词', '商品关键词', 'Keywords', 'Search Terms', 'Keyword'],
    brand: ['品牌', 'Brand'],
    sku: ['SKU', '货号', '商品编号', 'MPN'],
    model: ['型号', 'Model', '规格型号'],
    description: ['产品详情', '商品详情', '产品描述', '详细描述', 'Description', 'Product Description'],
    material: ['材质', '材料', 'Material'],
    power: ['功率', 'Power', 'Rated Power'],
    voltage: ['电压', 'Voltage'],
    capacity: ['容量', '容积', 'Capacity'],
    moq: ['起订量', 'MOQ', 'Min Order'],
    price: ['价格', '单价', 'Price', 'FOB'],
  }

  function toPatterns(list) {
    return (list || []).map(function (item) {
      const escaped = String(item).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp('^\\s*' + escaped + '\\s*[:：]?\\s*$', 'i')
    })
  }

  const PATTERNS = {}
  Object.keys(DICT).forEach(function (key) {
    PATTERNS[key] = toPatterns(DICT[key])
  })

  function labelsFor(field) {
    if (field === 'title' || field === 'name') return DICT.productName
    return DICT[field] || []
  }

  function patternsFor(field) {
    if (field === 'title' || field === 'name') return PATTERNS.productName
    return PATTERNS[field] || []
  }

  function matchLabel(text, field) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim()
    if (!raw || raw.length > 120) return false
    return patternsFor(field).some(function (re) {
      return re.test(raw)
    })
  }

  ns.content.labelDict = {
    DICT: DICT,
    PATTERNS: PATTERNS,
    labelsFor: labelsFor,
    patternsFor: patternsFor,
    matchLabel: matchLabel,
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
