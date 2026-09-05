;(function () {
  'use strict'
  const $ = function (id) {
    return document.getElementById(id)
  }
  let saveTimer = null
  let bundle = null
  let currentId = 'deepseek'

  function slot() {
    return ASD.providerConfigs.getConfig(bundle, currentId)
  }

  function meta() {
    return ASD.providerRegistry.get(currentId)
  }

  function showModelListButton() {
    const item = meta()
    const override = slot().capabilitiesOverride
    if (override && override.supportsModelList != null) return !!override.supportsModelList
    return !!(item && item.supportsModelList)
  }

  function fillProviderSelect(node, includeBlank) {
    node.replaceChildren()
    if (includeBlank) {
      const blank = document.createElement('option')
      blank.value = ''
      blank.textContent = '（智能自动）'
      node.appendChild(blank)
    }
    ASD.providerRegistry.list().forEach(function (item) {
      const opt = document.createElement('option')
      opt.value = item.id
      opt.textContent = item.name
      node.appendChild(opt)
    })
  }

  function routeMode() {
    if ($('modeFixed').checked) return 'fixed'
    if ($('modeAdvanced').checked) return 'advanced'
    return 'auto'
  }

  function costPref() {
    if ($('prefEconomy').checked) return 'economy'
    if ($('prefQuality').checked) return 'quality'
    return 'balanced'
  }

  function showRouting() {
    const mode = routeMode()
    $('autoPrefs').hidden = mode !== 'auto'
    $('fixedPrefs').hidden = mode !== 'fixed'
    $('advancedPrefs').hidden = mode !== 'advanced'
  }

  function renderRouting() {
    $('modeAuto').checked = bundle.activeMode !== 'fixed' && bundle.activeMode !== 'advanced'
    $('modeFixed').checked = bundle.activeMode === 'fixed'
    $('modeAdvanced').checked = bundle.activeMode === 'advanced'
    $('prefBalanced').checked = bundle.costPreference !== 'economy' && bundle.costPreference !== 'quality'
    $('prefEconomy').checked = bundle.costPreference === 'economy'
    $('prefQuality').checked = bundle.costPreference === 'quality'
    fillProviderSelect($('fixedProvider'), false)
    ;['advDiagnosisProvider', 'advVisionProvider', 'advTranslationProvider', 'advContentProvider'].forEach(function (id) {
      fillProviderSelect($(id), true)
    })
    const fixed = bundle.fixed || {}
    $('fixedProvider').value = ASD.providerRegistry.canonicalId(fixed.provider || currentId)
    $('fixedModel').value = fixed.model || ''
    const adv = bundle.advanced || {}
    $('advDiagnosisProvider').value = (adv.product_diagnosis && adv.product_diagnosis.provider) || ''
    $('advDiagnosisModel').value = (adv.product_diagnosis && adv.product_diagnosis.model) || ''
    $('advVisionProvider').value = (adv.vision_analysis && adv.vision_analysis.provider) || ''
    $('advVisionModel').value = (adv.vision_analysis && adv.vision_analysis.model) || ''
    $('advTranslationProvider').value = (adv.translation && adv.translation.provider) || ''
    $('advTranslationModel').value = (adv.translation && adv.translation.model) || ''
    $('advContentProvider').value = (adv.content && adv.content.provider) || ''
    $('advContentModel').value = (adv.content && adv.content.model) || ''
    $('orchAuto').checked = bundle.orchestrationMode !== 'single' && bundle.orchestrationMode !== 'multi'
    $('orchSingle').checked = bundle.orchestrationMode === 'single'
    $('orchMulti').checked = bundle.orchestrationMode === 'multi'
    showRouting()
  }

  function readRouting() {
    bundle.activeMode = routeMode()
    bundle.costPreference = costPref()
    bundle.fixed = {
      provider: $('fixedProvider').value,
      model: $('fixedModel').value.trim(),
    }
    bundle.orchestrationMode = $('orchMulti').checked ? 'multi' : $('orchSingle').checked ? 'single' : 'auto'
    bundle.advanced = {
      product_diagnosis: { provider: $('advDiagnosisProvider').value, model: $('advDiagnosisModel').value.trim() },
      vision_analysis: { provider: $('advVisionProvider').value, model: $('advVisionModel').value.trim() },
      translation: { provider: $('advTranslationProvider').value, model: $('advTranslationModel').value.trim() },
      content: { provider: $('advContentProvider').value, model: $('advContentModel').value.trim() },
    }
  }

  function renderSummary() {
    const box = $('enabledList')
    box.replaceChildren()
    const ids = ASD.providerConfigs.listConfigured(bundle)
    if (!ids.length) {
      box.textContent = '尚未保存任何 API Key'
      return
    }
    ids.forEach(function (id) {
      const item = ASD.providerRegistry.get(id)
      const cfg = bundle.configs[id]
      const line = ASD.dom.el(
        'p',
        null,
        (cfg.enabled ? '✓ ' : '○ ') +
          ((item && item.name) || id) +
          (cfg.participateInAuto ? ' · 参与自动路由' : ' · 不参与自动路由') +
          (cfg.model ? ' · ' + cfg.model : ''),
      )
      box.appendChild(line)
    })
  }

  function renderForm() {
    const item = meta()
    const cfg = slot()
    $('provider').value = currentId
    $('enabled').checked = !!cfg.enabled
    $('routeEnabled').checked = cfg.participateInAuto !== false
    $('customNameWrap').hidden = currentId !== 'custom'
    $('customName').value = cfg.displayName || ''
    $('apiKey').value = cfg.apiKey || ''
    $('baseUrl').value = cfg.baseUrl || (item && item.defaultBaseUrl) || ''
    $('model').value = cfg.model || (item && item.defaultModel) || ''
    $('thinkingWrap').hidden = currentId !== 'deepseek'
    $('thinking').value = cfg.thinking || 'disabled'
    $('refreshModels').hidden = !showModelListButton()
    $('advancedCaps').hidden = currentId !== 'custom'
    const caps = cfg.capabilitiesOverride || {}
    $('capVision').checked = !!caps.vision
    $('capJson').checked = caps.structuredOutput !== false
    $('capReasoning').checked = !!caps.reasoning
    $('capModelList').checked = !!caps.supportsModelList
    const list = $('modelList')
    list.replaceChildren()
    if (item && item.defaultModel) {
      const opt = document.createElement('option')
      opt.value = item.defaultModel
      list.appendChild(opt)
    }
    renderSummary()
    renderRouting()
  }

  function readForm() {
    const cfg = slot()
    cfg.enabled = $('enabled').checked
    cfg.participateInAuto = $('routeEnabled').checked
    cfg.displayName = $('customName').value.trim()
    const typed = $('apiKey').value.trim()
    if (typed) cfg.apiKey = typed
    cfg.baseUrl = $('baseUrl').value.trim().replace(/\/$/, '')
    cfg.model = $('model').value.trim()
    if (currentId === 'deepseek') cfg.thinking = $('thinking').value
    if (currentId === 'custom') {
      cfg.capabilitiesOverride = {
        vision: $('capVision').checked,
        structuredOutput: $('capJson').checked,
        reasoning: $('capReasoning').checked,
        supportsModelList: $('capModelList').checked,
      }
    }
    bundle.configs[currentId] = cfg
  }

  async function ensureCustomOrigin(url) {
    if (currentId !== 'custom' || !url || !chrome.permissions || !chrome.permissions.request) return true
    try {
      const origin = new URL(url).origin + '/*'
      const have = await chrome.permissions.contains({ origins: [origin] })
      if (have) return true
      return await chrome.permissions.request({ origins: [origin] })
    } catch (error) {
      return false
    }
  }

  async function persist(opts) {
    const options = opts || {}
    readForm()
    readRouting()
    const cfg = slot()
    if (options.validate) {
      if (!cfg.apiKey) throw new Error('请输入 ' + ((meta() && meta().name) || currentId) + ' API Key')
      if (!/^https:\/\//.test(cfg.baseUrl || '')) throw new Error('API 地址必须使用 HTTPS')
      if (currentId === 'custom') {
        const allowed = await ensureCustomOrigin(cfg.baseUrl)
        if (!allowed) throw new Error('自定义 API 地址需要授予该站点的访问权限')
      }
    }
    const legacy = ASD.providerConfigs.syncLegacy(bundle, { provider: currentId })
    await chrome.storage.local.set(Object.assign({ providerConfigs: bundle, provider: legacy.provider }, legacy))
    renderSummary()
    if (!options.quiet) $('status').textContent = '设置和 API Key 已保存'
  }

  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(function () {
      persist({ quiet: true })
        .then(function () {
          $('status').textContent = 'API Key 已自动保存'
        })
        .catch(function (error) {
          $('status').textContent = error.message
        })
    }, 350)
  }

  async function load() {
    const saved = await chrome.storage.local.get(ASD.storageKeys.SETTINGS)
    const merged = Object.assign({}, ASD.constants.DEFAULTS, saved)
    if (merged.apiKey && !merged.deepseekApiKey) merged.deepseekApiKey = merged.apiKey
    bundle = ASD.providerConfigs.migrate(merged)
    currentId = ASD.providerRegistry.canonicalId(saved.provider || merged.provider || 'deepseek')
    renderForm()
  }

  $('provider').addEventListener('change', function () {
    readForm()
    readRouting()
    currentId = $('provider').value
    renderForm()
    persist({ quiet: true }).catch(function (error) {
      $('status').textContent = error.message
    })
  })
  ;[
    'enabled',
    'routeEnabled',
    'baseUrl',
    'model',
    'thinking',
    'capVision',
    'capJson',
    'capReasoning',
    'capModelList',
    'modeAuto',
    'modeFixed',
    'modeAdvanced',
    'prefBalanced',
    'prefEconomy',
    'prefQuality',
    'fixedProvider',
    'fixedModel',
    'advDiagnosisProvider',
    'advDiagnosisModel',
    'advVisionProvider',
    'advVisionModel',
    'advTranslationProvider',
    'advTranslationModel',
    'advContentProvider',
    'advContentModel',
    'orchAuto',
    'orchSingle',
    'orchMulti',
  ].forEach(function (id) {
    $(id).addEventListener('change', function () {
      showRouting()
      persist({ quiet: true }).catch(function (error) {
        $('status').textContent = error.message
      })
    })
  })
  ;['apiKey', 'customName'].forEach(function (id) {
    $(id).addEventListener('input', scheduleSave)
  })
  $('save').addEventListener('click', function () {
    persist({ validate: true }).catch(function (error) {
      $('status').textContent = error.message
    })
  })
  $('test').addEventListener('click', async function () {
    try {
      await persist({ validate: true })
      $('status').textContent = '正在测试…'
      const result = await chrome.runtime.sendMessage({ type: 'TEST_AI', provider: currentId })
      $('status').textContent = result && result.ok
        ? (result.provider || currentId) + ' 连接成功 · ' + (result.model || '')
        : '连接失败：' + ((result && result.reason) || '未知错误')
    } catch (error) {
      $('status').textContent = error.message
    }
  })
  $('refreshModels').addEventListener('click', async function () {
    try {
      await persist({ validate: true, quiet: true })
      $('status').textContent = '正在获取账号可用模型…'
      const result = await chrome.runtime.sendMessage({ type: 'LIST_AI_MODELS', provider: currentId })
      if (!result || !result.ok) throw new Error((result && result.reason) || '获取模型失败')
      const list = $('modelList')
      list.replaceChildren()
      ;(result.models || []).forEach(function (id) {
        const option = document.createElement('option')
        option.value = id
        list.appendChild(option)
      })
      if (result.models && result.models.length && result.models.indexOf($('model').value) === -1) {
        $('model').value = result.models[0]
        await persist({ quiet: true })
      }
      $('status').textContent = result.models && result.models.length
        ? '已获取 ' + result.models.length + ' 个可用模型，当前：' + $('model').value
        : '账号未返回可用模型'
    } catch (error) {
      $('status').textContent = '获取模型失败：' + error.message
    }
  })

  load()
})()
