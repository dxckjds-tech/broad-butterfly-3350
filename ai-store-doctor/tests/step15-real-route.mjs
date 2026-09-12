#!/usr/bin/env node
/**
 * Live routing check. Uses DEEPSEEK_API_KEY and optional OPENAI_API_KEY / KIMI_API_KEY.
 * Offline default suite does not run this file.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const deepseekKey = process.env.DEEPSEEK_API_KEY || ''
const openaiKey = process.env.OPENAI_API_KEY || ''
const kimiKey = process.env.KIMI_API_KEY || ''

function load() {
  const stored = {
    provider: 'deepseek',
    deepseekApiKey: deepseekKey,
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-v4-flash',
    kimiApiKey: kimiKey,
    kimiBaseUrl: 'https://api.moonshot.cn/v1',
    kimiModel: 'kimi-k2.5',
    providerConfigs: {
      activeMode: 'auto',
      costPreference: 'economy',
      configs: {
        deepseek: {
          enabled: true,
          participateInAuto: true,
          apiKey: deepseekKey,
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
        },
        moonshot: {
          enabled: !!kimiKey,
          participateInAuto: true,
          apiKey: kimiKey,
          baseUrl: 'https://api.moonshot.cn/v1',
          model: 'kimi-k2.5',
        },
        openai: {
          enabled: !!openaiKey,
          participateInAuto: true,
          apiKey: openaiKey,
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
        },
      },
    },
  }
  const sandbox = {
    ASD: {},
    console: console,
    fetch: fetch,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Date: Date,
    Math: Math,
    AbortController: AbortController,
    chrome: {
      storage: {
        local: {
          get: async function () {
            return Object.assign({}, stored)
          },
        },
        onChanged: { addListener: function () {} },
      },
    },
  }
  sandbox.globalThis = sandbox
  const ctx = vm.createContext(sandbox)
  ;[
    'shared/constants.js',
    'shared/storage-keys.js',
    'shared/pii-patterns.js',
    'shared/sanitize.js',
    'shared/result-schema.js',
    'shared/task-types.js',
    'shared/task-validators.js',
    'shared/provider-registry.js',
    'shared/provider-configs.js',
    'shared/model-capabilities.js',
    'shared/task-profiles.js',
    'background/settings.js',
    'background/providers/openai-compatible.js',
    'background/providers/anthropic.js',
    'background/providers/gemini.js',
    'background/provider-manager.js',
    'background/model-health.js',
    'background/model-router.js',
    'background/ai-client.js',
  ].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx)
  })
  const cfg = sandbox.ASD.providerConfigs.migrate(
    Object.assign({}, stored, {
      providerConfigs: {
        activeMode: 'auto',
        costPreference: 'economy',
        configs: {
          deepseek: {
            enabled: true,
            participateInAuto: true,
            apiKey: deepseekKey,
            baseUrl: 'https://api.deepseek.com',
            model: 'deepseek-v4-flash',
          },
          moonshot: {
            enabled: !!kimiKey,
            participateInAuto: true,
            apiKey: kimiKey,
            baseUrl: 'https://api.moonshot.cn/v1',
            model: 'kimi-k2.5',
          },
          openai: {
            enabled: !!openaiKey,
            participateInAuto: true,
            apiKey: openaiKey,
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
          },
        },
      },
    }),
  )
  return { sandbox: sandbox, cfg: { providerConfigs: cfg } }
}

const report = {
  ok: true,
  deepseek: deepseekKey ? 'configured' : 'missing',
  openai: openaiKey ? 'configured' : 'adapter implemented / real API pending',
  kimi: kimiKey ? 'configured' : 'adapter implemented / real API pending',
  routes: {},
  live: {},
}

if (!deepseekKey) {
  report.ok = false
  report.error = 'DEEPSEEK_API_KEY missing; cannot run live routing'
  console.log(JSON.stringify(report, null, 2))
  process.exit(2)
}

const { sandbox, cfg } = load()
const translationPick = sandbox.ASD.bg.modelRouter.selectModel('translation', { settings: cfg, hasImages: false })
const diagnosisPick = sandbox.ASD.bg.modelRouter.selectModel('product_diagnosis', { settings: cfg, hasImages: false })
report.routes.translation = translationPick.selected && translationPick.selected.provider
report.routes.product_diagnosis = diagnosisPick.selected && diagnosisPick.selected.provider
report.routes.translationReason = translationPick.reason
report.routes.diagnosisReason = diagnosisPick.reason

if (!translationPick.ok || !diagnosisPick.ok) {
  report.ok = false
  report.error = 'router failed before live calls'
}

if (report.ok) {
  try {
    const translated = await sandbox.ASD.bg.aiClient.callAI({
      task: 'translation',
      messages: [
        { role: 'system', content: '只输出 JSON：{"translation":"中文"}' },
        { role: 'user', content: 'stainless steel ball valve' },
      ],
      maxTokens: 200,
    })
    report.live.translation = {
      status: 'PASS',
      provider: translated.provider,
      model: translated.model,
      text: translated.result && translated.result.translation,
      route: translated.route && translated.route.selected && translated.route.selected.provider,
    }
  } catch (error) {
    report.ok = false
    report.live.translation = { status: 'FAIL', reason: error.message }
  }
}

if (report.ok) {
  try {
    const ping = await sandbox.ASD.bg.aiClient.callAI({
      task: 'connection_test',
      provider: 'deepseek',
      messages: [
        { role: 'system', content: '你正在执行 API 连通性测试。只输出 JSON，不要解释。' },
        { role: 'user', content: '严格输出：\n{"ok":true,"message":"连接成功"}' },
      ],
      maxTokens: 512,
    })
    report.live.connection_test = {
      status: ping.result && ping.result.ok ? 'PASS' : 'FAIL',
      provider: ping.provider,
      model: ping.model,
    }
  } catch (error) {
    report.ok = false
    report.live.connection_test = { status: 'FAIL', reason: error.message }
  }
}

console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
