# AI 店铺医生 v1.6.1 — Step 14.1 + Step 15

统一 AI Provider 架构与智能模型路由。一次诊断仍是单一主任务，未拆成多模型编排。

## 1 Git Commit 列表

- `feat: route AI validation by task instead of product schema`
- `feat: add provider registry for multi-vendor AI backends`
- `feat: share one OpenAI-compatible adapter across chat providers`
- `feat: add Anthropic and Gemini provider adapters`
- `feat: migrate provider settings into a shared config bundle`
- `feat: resolve model capabilities from tables not name regex`
- `feat: add task profiles with required and preferred capabilities`
- `feat: add automatic model router with health-aware scoring`
- `feat: add routing UI, privacy update, and v1.6.1 pack`

## 2 Task Validator 架构

`shared/task-types.js` + `shared/task-validators.js`。`validateByTask(task, raw)`：

- `connection_test` → `{ ok: true }`，允许 `message`
- `translation` → 非空 `translation` 字符串
- `product_diagnosis` → 现有 `ASD.resultSchema`
- `raw_json` / `model_list` → 合法 JSON
- `ANALYZE_PRODUCT` 仍走 PII sanitize + 商品 Schema + Normalize + Retry

## 3 Provider Registry

`shared/provider-registry.js`：`id / name / apiStyle / defaultBaseUrl / defaultModel / supportsModelList / capabilities / adapter`。`kimi` 是 `moonshot` 别名。

## 4 Provider Adapters

- `background/providers/openai-compatible.js`：`sendRequest / testConnection / listModels / normalizeResponse`
- `background/providers/anthropic.js`
- `background/providers/gemini.js`
- `background/ai-client.js` 在 adapter `fetch` 之前强制 `sanitizePayload`

## 5 支持的 Provider

DeepSeek、Kimi/Moonshot、OpenAI、Claude/Anthropic、Gemini/Google、Qwen、Custom OpenAI-Compatible。

## 6 Custom OpenAI-Compatible

可填名称、API Key、Base URL、Model ID，并手工声明 Vision / JSON Mode / Reasoning / Model List。自定义源使用 `optional_host_permissions`，保存时请求该源权限。

## 7 旧配置迁移

`deepseekApiKey` / `apiKey` → `providerConfigs.configs.deepseek.apiKey`  
`kimiApiKey` → `configs.moonshot.apiKey`  
旧字段通过 `syncLegacy` 回写，不删除。

## 8 Model Capabilities

`shared/model-capabilities.js`。优先级：Provider 声明 → 已知模型表 → 用户覆盖 → 安全默认（未知 Vision/Reasoning = false）。Regex 仅作启发式 fallback。

## 9 Task Profiles

`shared/task-profiles.js`。`product_diagnosis` 在 `hasImages` 时把 vision 升为 required。本轮独立路由：`translation` / `connection_test` / `product_diagnosis`。

## 10 Router 评分逻辑

硬过滤：无 Key、disabled、缺 required capability、连续失败 ≥ 8 熔断。  
得分 = quality + reliability + speed + cost + taskMatch，再减去连续失败 ≥ 3 的临时罚分。  
模式权重：economy / balanced / quality。

## 11 Model Health

`background/model-health.js`：success/failure、连续失败、平均延迟。3 次失败降权，成功后可恢复。最多 1 个 CONNECTION_ERROR 备用，不做完整 Failover。

## 12 UI

设置页单一动态 Provider 表单 + 启用/参与自动路由。  
AI 调度模式：智能自动 / 固定模型 / 高级自定义。  
自动模式优化目标：平衡 / 省钱 / 最佳质量。  
Debug 展示本次自动选择的 Provider、Model、原因。

## 13 Mock Tests

Task validator、registry、OpenAI/Anthropic/Gemini adapter、迁移、capabilities、profiles、router A–G、health 降权/恢复、options 旧 Key 引导。

## 14 Real API Tests

见本轮实测记录。无 Key 的 Provider 标记为 `adapter implemented / real API pending`。

## 15 DeepSeek/Kimi 兼容结果

旧 DeepSeek / Kimi Key 经迁移后无需重填即可进入 `providerConfigs`，并由 router / adapter 继续调用。

## 16 Security Regression

sanitize 缺失时禁止出网。所有 adapter（含 Custom）只接收 ai-client 已脱敏 messages。商品诊断 Schema 未放宽。Health / History / Diff 规则未改。

## 17 当前 TODO

- Kimi / OpenAI / Anthropic / Gemini / Qwen 真实 Key 验收
- Custom 源权限授权的人工确认
- Step 16 完整 Failover 与 Multi-Model Orchestration

## 18 是否可以进入下一阶段 Multi-Model Orchestration

NO。本轮只完成 Provider 层与单任务路由。一次 `ANALYZE_PRODUCT` 仍是单一主诊断模型。等验收后再拆 vision / facts / keywords / content / synthesis。
