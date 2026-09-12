# AI 店铺医生 v1.6.0 Step 10–12 完成报告

日期：2026-09-05  
范围：仅 Step 10 健康评分、Step 11 历史诊断、Step 12 当前 VS AI 建议。  
未开始：Step 13 MutationObserver、Step 14 CWS、CRM、询盘、SaaS。

`REAL_AI_REGRESSION_PENDING` 仍保留。本轮评分/对比测试使用 validated fixture report，未声称真实 DeepSeek/Kimi 已通过。

---

## 1. Git Commit 列表

| Commit | 对应 | 说明 |
|---|---|---|
| `6b4be3a` | 14 / Step 10 核心 | 确定性 6 维健康评分纯函数 |
| `28c8e0f` | 15 / Step 10 UI | Overview 顶部健康度、Top 3 问题/动作 |
| `220d75f` | 16 / Step 11 Store | HistoryStore + 100/101 淘汰 |
| `a82101e` | 17 / Step 11 UI | 保存诊断、历史 Tab、查看/重分析/删除 |
| `1542b92` | 18 / Step 12 核心 | 词级标题 diff、关键词 Set、段落详情 |
| `2de74ac` | 19 / Step 12 UI | 当前 VS AI 建议，`shared/dom.js` 渲染 |

---

## 2. Step 10 健康评分

规则：程序纯函数 `ASD.healthScore.compute(product, report)`。`scoreVersion = 1.0`。不读取 AI 的 `healthScore` / `qualityScore`。

| 维度 | 满分 |
|---|---:|
| 商品信息完整度 | 20 |
| 标题质量 | 20 |
| 关键词质量 | 15 |
| 商品详情质量 | 20 |
| 买家信任信息 | 15 |
| FAQ / GEO 准备度 | 10 |

等级：90+ 优秀 / 75–89 良好 / 60–74 待优化 / 40–59 较差 / 0–39 严重问题。

测试（同一输入连续 20 次结果完全相同）：

| Case | 分数 | 区间 |
|---|---:|---|
| A 完整优秀商品 | 100 | ≥85 |
| B 标题+少量文字 | 44 | 40–70 |
| C 几乎空白 | 0 | ≤40 |
| D 大量营销词缺事实 | 26 | 不能高分 |
| E 完整 VERIFIED vs 缺资料亲戚 | 100 vs 61 | 完整明显高于缺资料 |

UI：Overview 顶部「商品健康度」总分 + 6 条进度条 + 最多 3 个优先问题 + 3 个优先动作。新 markup 只用 `shared/dom.js`。

---

## 3. Step 11 历史

Storage：

- `hist:idx` 轻量摘要：`id / productName / url / healthScore / createdAt / model / productIdentity`
- `hist:<id>` 单条报告 + `productSnapshot`（current.title/keywords/description + product 核心字段 + company）
- 版本：`promptVersion` `schemaVersion` `scoreVersion` `extensionVersion`
- 禁止：`data:image`、fallbackText、visibleText、页面 HTML
- 写入前走 `sanitizeCollected`
- 禁止 `chrome.storage.local.get(null)`（settings / history / AI 路径均为 0）

容量：100 条约 **95 KB**（目标 <1.5MB）。

淘汰：写第 101 条后 index 仍为 100，最旧 `Item 0` 被删除。

保存：分析完成后用户点击「保存诊断」，成功文案「已保存到历史诊断」。不自动保存。

查看历史使用当时 snapshot/report/health，不读当前 `state.fields`。重新分析不覆盖旧记录，可另存为新报告。

---

## 4. Step 12 对比

标题：词级 LCS。增加 `DN50`、删除 `High Quality`、完全相同均可测。

关键词：Set 比较 → 保留 / 建议新增 / 不建议继续使用（blocked + removed）。

详情：段落级当前文本 vs AI `overview / specifications / applications` 等结构。

理由只引用 product / VERIFIED facts 中已有证据。页面没有 Stainless Steel 时，不会写「增加 Stainless Steel」。

FAQ / GEO：当前显示未配置，建议显示 AI 新增内容。每块可复制。全部 `ASD.dom`，无 innerHTML。

---

## 5. 新增文件

```
shared/health-score.js
shared/diff.js
sidepanel/history-store.js
sidepanel/render/health.js
sidepanel/render/history.js
sidepanel/render/compare.js
tests/step10-health-score.mjs
tests/step11-history.mjs
tests/step12-diff.mjs
STEP-10-12-REPORT.md
```

---

## 6. 修改文件

```
sidepanel.html
sidepanel/app.js
sidepanel/actions.js
sidepanel/state.js
sidepanel/styles.css
tests/package.json
tests/sidepanel-boot.mjs
tests/step9-concurrency.mjs
TODO-v1.6.md
```

未改 Step 4–9 可信诊断核心、Prompt 正文、Schema、权限。

---

## 7. Regression

`npm run regression` 全部 PASS：采集 / PII / payload / Schema / 图片 / 并发 / 评分 / 历史 / diff，以及 v1.5.1 fields baseline 与 render-smoke。

---

## 8. Chrome 人工测试

用 fixture 报告验证 Side Panel：健康度卡片、历史 Tab、对比区。无 Key，不跑真实 AI。

---

## 9. REAL_AI_REGRESSION 状态

**PENDING**

---

## 10. TODO

仍开着：Kimi 双默认模型、options datalist innerHTML、存量 tab 未迁 dom.js、`.modal` CSS、真实 AI 回归、后台 AbortController。

已交付：健康评分、历史诊断、当前 VS AI 建议。

---

## 11. 是否可以进入 Step 13

**YES**
