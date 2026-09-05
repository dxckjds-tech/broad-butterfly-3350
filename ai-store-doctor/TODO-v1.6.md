# TODO v1.6 / v1.7 技术债

## 已完成（v1.6.1 Provider + Router）

- [x] Step 14.1 Task Validator / Provider Registry / Adapters / Settings 迁移
- [x] Step 15 Capability / Task Profile / Model Router / Routing UI

## 已完成（v1.6.0 RC 代码）

- [x] Step 4–12 可信诊断与产品价值层
- [x] Step 12.1 标题证据边界 + History sanitizer fail-closed
- [x] Step 13 MutationObserver + 低频轮询 + 采集质量
- [x] Kimi 默认模型统一为 `shared/constants.js` 的 `kimi-k2.5`
- [x] options datalist 改为 `replaceChildren()`
- [x] 删除无用 `.modal` CSS
- [x] Manifest CSP `extension_pages`
- [x] PRIVACY.md / README / 发布 ZIP 排除 tests

## 仍待真实环境

- [x] REAL_AI DeepSeek：MIC + VEMIC fixture 已用环境 Key 跑通（Step 14）
- [ ] REAL_AI Kimi：环境无 `KIMI_API_KEY`，正式版前仍需 1 MIC + 1 VEMIC
- [ ] 视觉模型：Logo 在前、商品图在后的真实页确认
- [ ] RC 人工：5–10 个不同品类商品页
- [ ] Chrome Web Store 最终发布

## 已完成（v1.6.2 Step 16.1）

- [x] 三阶段编排（证据 / 诊断 / 内容），最多 3 次调用
- [x] orchestrationMode: auto / single / multi
- [x] 相邻同模型合并；Vision 不得升为 VERIFIED

## 下一阶段（未开始）

- Step 16.2 精确 Token/成本统计
- 完整自动 Failover / 多模型互评
- 批量店铺分析 / CRM / 询盘

## v1.7 技术债（本轮不修）

- 存量 overview / truth / keywords / content / debug 仍用 `esc()` + `innerHTML`，不强制迁到 `dom.js`
- CRM / 询盘 / WhatsApp / 企业微信 / SaaS / 批量诊断 / 新 Agent
