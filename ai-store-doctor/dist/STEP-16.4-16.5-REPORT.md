# AI 店铺医生 v1.6.4-rc1 — Step 16.4 + 16.5

Input/Output Boundary Hardening + User-Configurable Multi-Model Collaboration.

`manifest` / `EXTENSION_VERSION`: `1.6.4`  
`PROMPT_VERSION`: `1.6.0`（未改）  
Release: `v1.6.4-rc1`

**Step 17 可否开始：NO**

本轮完成后，v1.6.x 单商品多模型协作基础设施已在代码与离线回归收口。真实验收仍缺第二个 Provider Key，因此不能进入批量 / 整店体检。

---

## 1 Response Normalize

统一实现：`shared/response-normalize.js`。

E1 `message.content` string → E2 content array text part → E3 provider-specific final field → E4 reasoning recovery → E5 thinking block → E6 truncation structural repair。

Adapter（OpenAI-compatible / Anthropic / Gemini）只做 `buildRequest` / transport / `classifyHttp` / provider extract hook / usage，再调用同一份 `ASD.responseNormalize.normalizeResponse`。`ai-client.js` 不再定义 `normalizeResponse`。

安全 debug 只记：provider / model / status / finishReason / contentType / contentLength / partTypes / reasoningLength / messageKeys / usage / contentSource / requestShape / errorClass。禁止 raw response、content preview、prompt、messages、API Key、Authorization。

## 2 Kimi Compatibility

Moonshot 字符串 content、array text part、thinking-only、empty stop、reasoning recovery、length truncated 均走同一 pipeline。

- empty stop + 无可识别正式 content → `EMPTY_FINAL_CONTENT`（connection_test 若能从 reasoning 恢复则可作为 liveness 降级成功）
- `finish_reason=length` → `OUTPUT_TRUNCATED`
- reasoning-only → `contentSource=REASONING_RECOVERY`，不得当正式 content
- 禁止 `retry_same`：同一 maxTokens + 更长 retry prompt 已删除；length retry 只提高输出预算

## 3 PARAM_REJECTED / Health

新增错误类：`PARAM_REJECTED`、`EMPTY_FINAL_CONTENT`、`EMPTY_CHOICES`、`CONTENT_FILTERED`、`QUOTA_ERROR`、`OUTPUT_TRUNCATED`。

`PARAM_REJECTED`（invalid temperature、response_format unsupported、thinking unsupported 等明确参数拒绝）**不计入 Model Health failure**。`ai-client.skipHealthFailure` + `model-health.recordFailure` 均跳过。

`shared/capability-learning.js` 只在明确参数拒绝消息上学习，例如 `temperature only 1 allowed` → `{ temperature: { mode: 'fixed', value: 1 } }`，写入 provider+model capability override。普通生成错误不会改 capability。

## 4 MIC Field Resolution

`detectPageProfile(hostname, pathname)`：

- `mic-detail`
- `mic-membercenter-edit`
- `mic-membercenter-list`
- `vemic`
- `generic`

`debug.site` 仍写 family（`mic`/`vemic`/`generic`），`debug.pageProfile` 写页面类型。

membercenter 使用自己的 field resolution profile，不再把前台 `h1` / breadcrumb 当主策略。

Tiers：T1 EXPLICIT_FORM → T2 LABEL_ANCHORED → T3 STRUCTURED_SCRIPT → T4 JSON_LD → T5 PAIRED_ID_TEXT → T6 SEMANTIC_DOM → T7 SPEC_ROW → T8 FALLBACK。

T1 只匹配可见 `input/textarea/select`（hidden 不走 T1）。Hidden 必须在 productRoot + 白名单（cat/category/class/industry/spu/sku/model/brand/unit/currency…），禁止 token/session/csrf/user/account/auth。

Structured script 只读 `application/json`、`application/ld+json`、白名单 `data-*` JSON。禁止 `window.__INITIAL_STATE__`、React Fiber、Vue store、MAIN world。

ProductRoot 删除裸 `form`；保留 `form:has(textarea|table|商品控件)`。

membercenter-edit 上「操作」列不误判为 list。

Category 双轨：`{ value, path, id, sourceType, confidence }` → `product.categoryMeta`。

离线结果：membercenter-edit `qualityScore=100`，title/category/keywords 均召回。

## 5 Legacy Body Path Removal

AI payload 主路径不再发送：

- 全页 `visibleText`
- 全页 `formFields`
- `doc.body` fallback

`payload-builder` 将 `visibleText`/`formFields` 置空；`fallbackText` 有界 1200 且低置信。productRoot 失败不回 body。

`extractFields` / content-script `extractOne` **尚未删除**（双轨质量对比与旧 fixture 仍调用）。它们已限制在 productRoot，不再扫 `doc.body`。这是刻意顺序：先达标再删。

未新增 `scripting` / `cookies` / `webRequest` / `<all_urls>`。

## 6 Field Provenance

每个核心字段带 `fieldProvenance`：`tier` / `strategy` / `confidence` / `sourceType` / `sourceRef`。

进入 Risk Engine / Verifier / Final Guard。VERIFIED 必须同时满足：

- sourceType allowlist：`EXPLICIT_FORM` / `SPEC_TABLE` / `JSON_LD` / `PAIRED_ID_TEXT` / `EXPLICIT_PAGE_FIELD`
- 足够 confidence

低信任来源不能支撑 VERIFIED：`SEMANTIC_DOM` / `FALLBACK` / `VISION` / `REASONING_RECOVERY`。

## 7 Collaboration Modes

设置页「AI 协作模式」：

- 智能自动 `auto`
- 自由组合 `custom`
- 单模型 `single`
- 混合模式 `hybrid`

原则：Role 固定，Model / Provider 自由，数量不强制。禁止品牌硬绑定。

失败策略：自动切备用 / 询问我 / 停止。AUTO/HYBRID 默认自动备用；CUSTOM 默认询问。

## 8 Role Assignments

固定 Roles：Evidence / Reasoning / Keywords / Content / Verifier。

`roleAssignments` 每项可为 `{ mode: 'fixed', provider, model }` 或 `{ mode: 'auto' }`。

同一模型可承担全部 Role。只配置 1 或 2 个模型时，系统允许复用，不要求 5 个模型。

CUSTOM/FIXED 下，能力不满足（例如 Evidence 固定到无 Vision 模型但当前有图）返回 `ROLE_CAPABILITY_MISMATCH`，提示「当前固定模型不支持视觉输入」，选项：继续文本 / 临时自动 / 取消。**不会偷偷换模型。**

## 9 Scheduler

`background/collaboration-scheduler.js`。

依赖：Evidence → Reasoning →（Keywords ∥ Content Brief）→ Content → Verifier（仅高风险）。

只并行无数据依赖的 Role。所有 Role 计入 Execution Budget。

默认 AUTO 且仅 1 个 Provider 时，planner 仍走原三阶段/单模型路径，保证 Step 16.1–16.3 编排测试继续 PASS。

## 10 Role Merge

同模型相邻/兼容 Role 允许合并，不强制。

Case E：Reasoning + Keywords 同为 DeepSeek 时，Planner 可一次输出两个 Role Schema。Schema 过重或预算不足时拆开。

`MAX_ORCHESTRATION_CALLS = 4`。Economy 仍为 `maxCalls: 2`（兼容既有 budget 测试；规格 2–3）。Balanced/Quality：4。Verifier 仅高风险触发。

## 11 Fusion Engine

`background/fusion-engine.js` 程序主导融合。

只接 validated Role outputs + page provenance + trusted evidence + verifier decisions。禁止 raw model response。禁止按模型数量投票。

优先级：trusted structured page > explicit form > JSON-LD > verified role-derived reasoning > visual observation > model inference。

Case F 离线：页面 Power=1200W，三模型说 1500W → 最终 `1200W VERIFIED`，1500W 为 CONFLICT/OBSERVED。

## 12 Budget

多模型协作不绕过 `maxCalls` / `maxDuration` / cost / token hard limit。

Economy 2；Balanced 4；Quality 4。Role 合并用来避免「5 Role = 5 次调用」。

## 13 UI

设置页新增 AI 协作卡片：四模式 + 五 Role 下拉 + 失败策略。

连接测试两级：

```text
API连接：成功
结构化输出：成功 | 受限 | 失败
```

liveness 只要求 HTTP 成功 + 可识别内容，不强制 `{"ok":true}`。商品诊断仍强制 JSON + Task Schema + Result Schema + Normalize。

Sidepanel 概览显示协作计划与实际调用。History 保存 `collaboration: { mode, assignments, actualExecution, mergedRoles }`。禁止 raw outputs / prompts / keys / Authorization / image base64。

## 14 Regression

`npm run regression`（含 Step 0–16.3.2 与本轮新增）PASS，并打包 `AI-Store-Doctor-v1.6.4-rc1.zip`。

本轮新增：

- `tests/step16-field-resolution.mjs`
- `tests/step16-response-boundary.mjs`
- `tests/step16-collaboration.mjs`

MIC fixtures：`10` edit、`11` list、`12` operation-table、`13` random-input-name、`14` hidden-token-negative。

断言覆盖：title/category/keywords、quality≥85、操作列不误判 list、hidden token 不读取、productRoot 失败不回 body、normalize 单实现、PARAM_REJECTED 不污染 health、reasoning recovery 有 contentSource、length 不 retry_same、connection liveness 不要求 `ok:true`。

Case A–H 离线全部 PASS。

## 15 Real Dual-Provider Test

**PENDING — `REAL_MULTI_PROVIDER_PENDING`**

环境仅有 `DEEPSEEK_API_KEY`。无 Kimi / OpenAI / Claude / Gemini / Qwen Key。

真实 DeepSeek 单模型仍跑通 4 个 fixture（`step16-real-multi.mjs`）：

| case | mode | calls | identity | health |
| --- | --- | --- | --- | --- |
| mic-01 | single | 1 | Canister Vacuum Cleaner 20L | 81 |
| mic-05 | single | 1 | Industrial Ball Valve DN50 | 53 |
| vemic-02 | single | 1 | Steam Cleaner Portable Home Vacuum… | 60 |
| dyn-04 | single | 1 | UNKNOWN（动态页无完整商品） | 6 |

真实 DeepSeek 连接测试两级：

- API连接：成功
- 结构化输出：成功
- `contentSource=MESSAGE_CONTENT`
- 无 raw / Key 泄漏

不能声称 live 双 Provider 协作。

## 16 Real Custom Combination Test

**PENDING**

离线 Case B PASS（Evidence→Kimi，Reasoning/Keywords/Verifier→DeepSeek，Content→Kimi，严格按用户组合）。

真实自由组合需要第二个 Provider Key，本环境无法手工执行。

## 17 Real Hybrid Test

**PENDING**

离线 Case C PASS（Evidence 固定 Kimi、Keywords 固定 DeepSeek，其余 auto；固定项不被 Router 替换）。

真实 Hybrid 同样等待第二把 Key。

## 18 Conflict Test

**离线 PASS，真实页面冲突 PENDING**

Fusion Case F：页面 1200W vs 三模型 1500W → 1200W VERIFIED。

Risk 人造高风险样本（页面 1200W vs vision 1500W）触发 `fact_conflict` + `verified_without_trusted_source`。

未在真实商品页制造视觉/模型 vs 页面事实冲突。

## 19 Current TODO

- 第二把真实 Key（Kimi 或 OpenAI）后补：双 Provider、真实 CUSTOM、真实 HYBRID、真实页面冲突
- 真实 Kimi MIC + VEMIC（历史债）
- Keywords 作为独立 orch stage 仅部分接线：scheduler 可发出 keywords；默认 AUTO 仍并入 diagnosis covers
- `extractFields` / `extractOne` 待召回稳定后删除
- 视觉模型：Logo 在前、商品图在后的真实页确认
- RC 人工：5–10 个不同品类商品页
- **不要开始 Step 17**（批量扫描 / MIC 写回 / CRM / 询盘 / WhatsApp / 邮件自动跟进）

## 20 Whether Step 17 can start

**NO**

原因：

1. 真实验收要求至少两个 Provider，本环境只有 DeepSeek。
2. 真实自由组合 / 真实 Hybrid / 真实页面冲突尚未手工跑过。
3. 规格要求本轮完成后停止，等待最终验收。

---

## Downloads

- Extension zip: https://raw.githubusercontent.com/dxckjds-tech/broad-butterfly-3350/cursor/v16-step16-boundary-collab-2c46/dist/AI-Store-Doctor-v1.6.4-rc1.zip
- This report: https://raw.githubusercontent.com/dxckjds-tech/broad-butterfly-3350/cursor/v16-step16-boundary-collab-2c46/dist/STEP-16.4-16.5-REPORT.md
- Real multi JSON: https://raw.githubusercontent.com/dxckjds-tech/broad-butterfly-3350/cursor/v16-step16-boundary-collab-2c46/dist/STEP-16.4-16.5-REAL-MULTI.json
