# AI 店铺医生 v1.6.2-rc1 — Step 16.1

Three-Stage Multi-Model Orchestrator。未进入精确 Token 账单、复杂 Failover、互评或 CRM。

## 1 Git Commit 列表

- `feat: add three-stage multi-model orchestration planner`
- `feat: add evidence stage with provenance-safe schema`
- `feat: add diagnosis reasoning stage`
- `feat: add content generation stage`
- `feat: merge adjacent stages on same routed model`
- `feat: add orchestration debug and regression coverage`

## 2 Orchestrator 架构

`background/orchestrator.js` → `runProductDiagnosis()`：

sanitize → plan → Stage 1/2/3（或合并）→ validate → `finalizeOrchestrationReport()` → 现有 `ASD.resultSchema`。

`orchestrationMode`：`auto`（默认）/ `single` / `multi`。1 个可用 Provider 时 auto 必为 single。

## 3 三阶段 Schema

`shared/orchestration-schemas.js`

- Stage 1：identityCandidates / evidence / imageObservations / unknowns。禁止 INFERRED；vision 不得 VERIFIED。
- Stage 2：identity / facts / diagnosis / keywordStrategy / contentBrief。
- Stage 3：兼容现有 report content/keywords，再组装最终 schema。

## 4 Planner

`background/orchestration-planner.js` 按任务 profile 分别路由：

`evidence_analysis` / `diagnosis_reasoning` / `content_generation`。

Quality 维：证据看 vision，诊断看 reasoning，内容看 writing。未改 `DEFAULT_SCORES`。

## 5 Stage 合并

相邻阶段同一 provider+model 则合并。  
diagnosis+content 优先。  
evidence+diagnosis 仅当 `vision && structuredOutput && reasoning`。  
超过 3 次：`ORCHESTRATION_BUDGET_EXCEEDED`。

## 6 Router 结果（Mock）

| Case | 结果 |
| --- | --- |
| A 1 Provider | mode=single, calls=1 |
| B 视觉+推理/写作 | Stage1=Gemini, Stage2+3=Anthropic, calls=2 |
| C Quality 三强 | Gemini / Anthropic / OpenAI, calls=3 |
| D Economy 无图 | single（低成本模型满足文本能力） |
| H 同模型 2+3 | 必须合并 |

## 7 Evidence 状态保护

Vision `Stainless Steel` → OBSERVED。Stage 2 不得升为 VERIFIED。  
页面 spec_table 的 Material 可 VERIFIED 并保持。  
UNKNOWN 不得进入 Stage 3 specifications。

## 8 Provenance

每条 evidence/fact 带 `sourceType/sourceRef/sourceStage/sourceModel/sourceProvider`。  
vision 不得改写成 product_field。普通 UI 不展示，Debug / History 内部可存精简分工。

## 9 调用预算

`MAX_ORCHESTRATION_CALLS = 3`。不含 model_list / connection_test。

## 10 Fallback 行为

默认不自动切模型。仅 `CONNECTION_ERROR` / `TIMEOUT` / `RATE_LIMIT_ERROR` 且剩余 budget≥1 时允许 1 次 fallback。  
`SCHEMA_ERROR` / `VALIDATION_ERROR` 不换模型。整次诊断仍 ≤3 次。

## 11 History

只存 `orchestration.mode/stages/provider/model/totalCalls`。  
禁止 raw stage、完整 Prompt、base64、fallbackText。

## 12 Mock Tests

`step16-planner` / `evidence-schema` / `provenance` / `orchestrator`：A–L 覆盖。sanitize 缺失禁止出网。

## 13 Regression

`npm run regression` 全部 PASS（Step 0–15.1 + 16.1）。`orchestrationMode=single` 走一次 `product_diagnosis`。

## 14 Real Multi-Provider Test

环境仅有 `DEEPSEEK_API_KEY`。Planner 正确 auto→single，未假装多模型。

| 样本 | mode | calls | duration | identity | facts | health |
| --- | --- | --- | --- | --- | --- | --- |
| MIC 01 | single | 1 | 10871ms | Canister Vacuum Cleaner 20L | 11 | 81 |
| MIC 05 | single | 1 | 11122ms | Industrial Ball Valve DN50 | 9 | 55 |
| VEMIC 02 | single | 1 | 12438ms | Steam Cleaner Portable Home Vacuum Cleaner with CE Certification | 11 | 62 |

双 Provider 真实现场（DeepSeek+OpenAI/Kimi）**PENDING**（缺第二把 Key）。第二份 VEMIC 商品页 fixture 不足。

## 15 性能

单模型真实诊断约 11–12 秒 / 1 次调用。Mock 多模型规划本身无网络。未做 Token 计价。

## 16 当前 TODO

- 双真实 Provider 验收 multi（DeepSeek + OpenAI 或 Kimi）
- 第二份真实 VEMIC 商品页
- 精确 Token/成本
- 完整 Failover / 互评 — 不做

## 17 是否可以进入 Step 16.2

**NO。**

Mock 与 single 真机已通过，但双 Provider 真实协同未跑通。等待下一轮验收，不进入 Token 账单、复杂 Failover、并行投票、互评、批量诊断或 CRM。
