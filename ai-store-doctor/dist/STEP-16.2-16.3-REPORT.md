# AI 店铺医生 v1.6.3 — Step 16.2 + 16.3

Release tag: `v1.6.3-rc1`（内部候选，非正式发布）

Pack:

- https://raw.githubusercontent.com/dxckjds-tech/broad-butterfly-3350/cursor/v16-step16-budget-verify-2c46/dist/AI-Store-Doctor-v1.6.3-rc1.zip
- https://raw.githubusercontent.com/dxckjds-tech/broad-butterfly-3350/cursor/v16-step16-budget-verify-2c46/dist/STEP-16.2-16.3-REPORT.md

`REAL_MULTI_PROVIDER_PENDING`：当前环境只有 DeepSeek，不能声称已完成真实多模型协同。

---

## 1 Git Commit 列表

1. `feat: add orchestration execution budget and usage accounting`
2. `feat: add bounded failover and health-aware replanning`
3. `feat: add model pricing and cost-aware orchestration`
4. `feat: add deterministic high-risk verification engine`
5. `feat: add fact verification task and schema`
6. `feat: add final report evidence guard`
7. `feat: add verification UI metadata and regression coverage`

---

## 2 Execution Budget

`background/execution-budget.js` 统一维护：

```text
mode, maxCalls, maxDurationMs, maxInputTokens, maxOutputTokens, maxEstimatedCostUsd
usedCalls, elapsedMs, inputTokens, outputTokens, estimatedCostUsd
```

默认：

| mode | maxCalls | maxDurationMs | 第 4 次 |
| --- | --- | --- | --- |
| Economy | 2 | 25000 | 不预留 verifier |
| Balanced | 4 | 40000 | 默认预留给 high-risk verifier |
| Quality | 4 | 50000 | 同上 |

Stage 软超时：Evidence 15s / Diagnosis 20s / Content 20s / Verification 15s。真实超时 = `min(stageTimeout, remainingGlobalTime)`。

每一次真实 AI 请求都 `consumeCall()`：primary、fallback、retry、schema repair、verifier。

---

## 3 Failover Policy

`background/failover-policy.js` → `decideFailureAction()`：

- 允许跨模型：`NETWORK_ERROR` / `CONNECTION_ERROR` / `RATE_LIMIT_ERROR` / `TIMEOUT` / `MODEL_NOT_FOUND` / `PROVIDER_ERROR`
- 禁止跨模型：`AUTH_ERROR` / `VALIDATION_ERROR` / `EVIDENCE_CONFLICT` / `UNSUPPORTED_CAPABILITY`
- `SCHEMA_ERROR` → 同模型 repair 一次（计入预算）
- `LENGTH_ERROR` → 同模型提高 maxOutputTokens 一次（计入预算）
- 每 Stage 最多 `primary + 1 fallback`

---

## 4 Replan 逻辑

`orchestrationPlanner.replanAfterFailure({ remainingCalls, remainingDuration, remainingCost, remainingStages, verificationRisk })`

决定：合并后续阶段、跳过 verifier、partial、stop。

Failover 已消耗调用时，不再为 verifier 预留第 4 次；第 4 次给 Stage3，风险改由程序 Guard 处理。

视觉 Stage 失败且页面文本足够：降级为 text-only evidence，不新增调用。

---

## 5 Model Health

扩展：`rateLimitCount` / `timeoutCount` / `schemaFailureCount` / `lastErrorType` / `disabledUntil` / `needsAttention`。

- 连续失败 ≥ 3：降权 25
- 连续失败 ≥ 5：`disabledUntil = now + 5min`
- `AUTH_ERROR`：`needsAttention=true`，该 Provider 暂不参与自动路由
- 连通测试成功：`clearAttention()`
- 429：记 `rateLimitCount`，尊重 `Retry-After`，否则短暂降权

---

## 6 Token Accounting

`background/token-accounting.js` 统一：

```js
{ inputTokens, outputTokens, totalTokens, estimated }
```

优先真实 `prompt_tokens` / `completion_tokens` / `input_tokens` / `output_tokens`。无 usage 时按字符/4 粗估，且 `estimated=true`。无大型 tokenizer 依赖。

---

## 7 Cost Accounting

`shared/model-pricing.js` 静态 USD registry。未知模型 / custom：`costKnown=false`，`estimatedCostUsd=null`，禁止编造金额。

Router 成本分：有 registry 用价格；没有则中性 70。不再把品牌写成 cheap/expensive。

---

## 8 Economy / Balanced / Quality

- Economy：`maxCalls=2`，优先合并 / 单模型，不主动 AI verifier
- Balanced：最多 3 次编排 + 可选第 4 次 high-risk verifier
- Quality：能力与可靠性优先，不是更贵加分；仍 `maxCalls<=4`

---

## 9 Risk Engine

`background/verification-risk.js` 纯程序规则，不调用 AI 判断“要不要调用 AI”。

0–29 low / 30–59 medium / 60–100 high。

low 不复核；medium 程序复核；high 且预算允许才调用 verifier。

---

## 10 High-Risk 触发条件

- 身份置信度 < 60
- 关键事实仅来自 vision（material / model / certification / power / voltage / capacity）
- 页面与模型事实冲突（如 1200W vs 1500W）
- `VERIFIED` 但 provenance 不是 `product_field` / `spec_table` / `json_ld` / `explicit_page_field`
- Stage1 与 Stage2 关键字段冲突
- 关键 fact 经过 schema repair
- 推理模型连续失败较多
- Stage3 把 OBSERVED / INFERRED / UNKNOWN 写成确定参数

---

## 11 Fact Verifier

Task：`fact_verification`。required：`text` + `structuredOutput`。preferred：reasoning / factAdherence / jsonReliability / reliability。

只做 `confirm | downgrade | reject`。禁止 `newFacts` / `suggestedFacts` / 重写报告。

输入只传 `claimsToVerify` + 可信页面证据 + provenance + 诊断决策。

即使 verifier confirm VERIFIED，程序仍按 provenance 终裁；vision 不能 VERIFIED。

尽量选不同 Provider/Model；只有一个时允许同模型，Debug 标 `independentVerification=false`。

---

## 12 Final Report Guard

`background/final-report-guard.js` 在交给 UI 前执行：

- 不可信 provenance 的 VERIFIED → OBSERVED
- rejected 从 title / detail / FAQ / GEO 清除
- UNKNOWN 不得进入 specifications / 标题确定参数
- 不改 `sourceType` / `sourceRef` / `sourceStage`

---

## 13 调用次数控制

正常无风险：Stage1–3，最多 3 次。  
高风险且无 failover：最多 4 次，第 4 次只给 verifier。  
Failover 用满 4 次：不再第 5 次，程序降级。  
Economy：最多 2 次，高风险只走 Guard。

---

## 14 History

可保存：总调用、耗时、token、估算成本（仅 `costKnown`）、fallbackUsed、riskScore、verificationTriggered、confirmed/downgraded/rejected。

禁止：verifier raw、原始 Prompt、Authorization、API Key、image base64、完整 Stage raw。

---

## 15 Mock Tests

全部 PASS：

- `tests/step16-budget.mjs` A/B/M（4 次硬顶、failover 占满、Economy 不超预算）
- `tests/step16-failover.mjs` C/D/E（AUTH / NETWORK / schema repair）
- `tests/step16-cost.mjs` O/P/Q（usage / unknown cost / cost replan）
- `tests/step16-risk.mjs` F/G/H
- `tests/step16-verifier.mjs` I/J/K/N + single 兼容
- `tests/step16-final-guard.mjs` F/L/R/S + History

---

## 16 Regression

`npm run regression` 全 PASS，包括 v1.5.1 fixtures、PII、schema、images、concurrency、health、history、diff、dynamic、provider、router、capability、Step 16.1 orchestration。

`orchestrationMode=single` 仍是一次 `product_diagnosis`，不自动 verifier。

---

## 17 Real Multi-Provider Test

```text
REAL_MULTI_PROVIDER_PENDING
```

`DEEPSEEK_API_KEY` 可用；`OPENAI_API_KEY` / `KIMI_API_KEY` 缺失。auto 回落 single，不能声称真实多模型协同。

---

## 18 Real High-Risk Verification Test

程序制造样本（页面 1200W vs vision 1500W + vision-only VERIFIED material + 低身份置信度）：

```text
score=100 level=high requiresVerification=true
```

真实 DeepSeek 单模型诊断（single，无第二模型 verifier）：

| sample | mode | calls | duration | tokens in/out | costKnown | health |
| --- | --- | --- | --- | --- | --- | --- |
| MIC 01 | single | 1 | ~11s | 真实 usage | false | 81 |
| MIC 05 | single | 1 | ~10s | 真实 usage | false | 53 |
| VEMIC 02 | single | 1 | ~12s | 真实 usage | false | 60 |
| VEMIC dyn-04 | single | 1 | ~2.4s | 真实 usage | false | 6 |

deepseek-v4-flash 不在定价表 → `costKnown=false`，未编造美元金额。

Verifier 实际跨模型调用：**未做**（缺第二 Provider）。

---

## 19 当前 TODO

- 配置第二真实 Provider，完成双模型编排 + 独立 verifier 验收
- 用真实冲突商品（图文不一致）跑一遍 Quality 第 4 次 verifier
- 通过后再确认 RC，不要把 v1.6.3-rc1 当正式版
- 不要开始 Step 17

---

## 20 是否可以进入 Step 17 批量 / 整店体检

**NO**

原因：双 Provider 真实验证未完成（`REAL_MULTI_PROVIDER_PENDING`）；正式 RC 门禁未齐。单商品智能诊断基础设施已在 mock 层收口，等待下一轮验收。
