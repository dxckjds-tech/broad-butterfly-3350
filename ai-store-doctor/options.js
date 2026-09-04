const $ = (id) => document.getElementById(id)
let saveTimer = null

function toggle() {
  const kimi = $('provider').value === 'kimi'
  $('kimiPanel').hidden = !kimi
  $('deepseekPanel').hidden = kimi
}

async function load() {
  const d = ASD.constants.DEFAULTS
  const s = await chrome.storage.local.get(null)
  $('provider').value = s.provider || d.provider
  $('deepseekApiKey').value = s.deepseekApiKey || s.apiKey || ''
  $('deepseekBaseUrl').value = s.deepseekBaseUrl || s.baseUrl || d.deepseekBaseUrl
  $('deepseekModel').value = s.deepseekModel || s.model || d.deepseekModel
  $('deepseekThinking').value = s.deepseekThinking || s.thinking || d.deepseekThinking
  $('kimiApiKey').value = s.kimiApiKey || ''
  $('kimiBaseUrl').value = s.kimiBaseUrl || d.kimiBaseUrl
  $('kimiModel').value = s.kimiModel || ASD.constants.OPTIONS_KIMI_MODEL_FALLBACK
  toggle()
}

function formData() {
  return {
    provider: $('provider').value,
    deepseekBaseUrl: $('deepseekBaseUrl').value.trim().replace(/\/$/, ''),
    deepseekModel: $('deepseekModel').value,
    deepseekThinking: $('deepseekThinking').value,
    kimiBaseUrl: $('kimiBaseUrl').value.trim().replace(/\/$/, ''),
    kimiModel: $('kimiModel').value,
  }
}

async function persist({ validate = false, quiet = false } = {}) {
  const data = formData()
  const deepseekKey = $('deepseekApiKey').value.trim()
  const kimiKey = $('kimiApiKey').value.trim()
  // Empty password fields never erase a previously saved key.
  if (deepseekKey) data.deepseekApiKey = deepseekKey
  if (kimiKey) data.kimiApiKey = kimiKey
  if (validate) {
    const saved = await chrome.storage.local.get(['deepseekApiKey', 'kimiApiKey', 'apiKey'])
    const activeKey =
      data.provider === 'kimi' ? kimiKey || saved.kimiApiKey : deepseekKey || saved.deepseekApiKey || saved.apiKey
    const activeUrl = data.provider === 'kimi' ? data.kimiBaseUrl : data.deepseekBaseUrl
    if (!activeKey) throw new Error(`请输入 ${data.provider === 'kimi' ? 'Kimi' : 'DeepSeek'} API Key`)
    if (!/^https:\/\//.test(activeUrl)) throw new Error('API 地址必须使用 HTTPS')
  }
  await chrome.storage.local.set(data)
  if (!quiet) $('status').textContent = '设置和 API Key 已保存'
}

function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(
    () =>
      persist({ quiet: true })
        .then(() => ($('status').textContent = 'API Key 已自动保存'))
        .catch((e) => ($('status').textContent = e.message)),
    350,
  )
}

$('provider').addEventListener('change', () => {
  toggle()
  persist({ quiet: true })
})
;['deepseekModel', 'deepseekThinking', 'kimiModel', 'deepseekBaseUrl', 'kimiBaseUrl'].forEach((id) =>
  $(id).addEventListener('change', () => persist({ quiet: true })),
)
;['deepseekApiKey', 'kimiApiKey'].forEach((id) => $(id).addEventListener('input', scheduleSave))
$('save').addEventListener('click', () =>
  persist({ validate: true }).catch((e) => ($('status').textContent = e.message)),
)
$('test').addEventListener('click', async () => {
  try {
    await persist({ validate: true })
    $('status').textContent = '正在测试…'
    const r = await chrome.runtime.sendMessage({ type: 'TEST_AI' })
    $('status').textContent = r?.ok
      ? `${r.provider} 连接成功 · ${r.model || ''}`
      : `连接失败：${r?.reason || '未知错误'}`
  } catch (e) {
    $('status').textContent = e.message
  }
})
async function refreshModels() {
  try {
    await persist({ validate: true, quiet: true })
    $('status').textContent = '正在获取账号可用模型…'
    const r = await chrome.runtime.sendMessage({ type: 'LIST_AI_MODELS' })
    if (!r?.ok) throw new Error(r?.reason || '获取模型失败')
    const list = $('kimiModels')
    list.innerHTML = ''
    r.models.forEach((id) => {
      const option = document.createElement('option')
      option.value = id
      list.appendChild(option)
    })
    if (r.models.length && !r.models.includes($('kimiModel').value)) {
      $('kimiModel').value = r.models[0]
      await persist({ quiet: true })
    }
    $('status').textContent = r.models.length
      ? `已获取 ${r.models.length} 个可用模型，当前：${$('kimiModel').value}`
      : '账号未返回可用模型'
  } catch (e) {
    $('status').textContent = `获取模型失败：${e.message}`
  }
}
$('refreshModels').addEventListener('click', refreshModels)
load()
