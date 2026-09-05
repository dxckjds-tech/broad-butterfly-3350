# TODO v1.6 / v1.7 技术债

## 已完成（v1.6.4 Step 16.4 + 16.5）

- [x] 统一 Response Normalize（E1–E6，单实现）
- [x] Kimi/Moonshot 恢复阶梯 + PARAM_REJECTED 不污染 Health
- [x] Capability runtime learning（仅明确参数拒绝）
- [x] MIC page profile + membercenter field resolution（T1–T8）
- [x] Field Provenance 进入 Risk / Verifier / Final Guard
- [x] AI payload 退出全页 body / visibleText / formFields
- [x] Role 固定、Model 自由：AUTO / CUSTOM / SINGLE / HYBRID
- [x] Collaboration Scheduler + Role Merge + Fusion Engine
- [x] 设置页 AI 协作 UI + 两级连接测试
- [x] Step 0–16.3.2 + 16.4/16.5 离线回归 PASS

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

- [x] REAL_AI DeepSeek：MIC + VEMIC fixture 已用环境 Key 跑通（含 v1.6.4 两级连接测试）
- [ ] REAL_AI 第二 Provider（Kimi / OpenAI / Claude / Gemini / Qwen）：环境无第二把 Key，`REAL_MULTI_PROVIDER_PENDING`
- [ ] 真实 CUSTOM 自由组合（Evidence → A，Reasoning → B）
- [ ] 真实 HYBRID（两 Role 固定，其余 Auto）
- [ ] 真实页面事实 vs 视觉/模型冲突
- [ ] REAL_AI Kimi：环境无 `KIMI_API_KEY`，正式版前仍需 1 MIC + 1 VEMIC
- [ ] 视觉模型：Logo 在前、商品图在后的真实页确认
- [ ] RC 人工：5–10 个不同品类商品页
- [ ] Chrome Web Store 最终发布

## 已完成（v1.6.2–v1.6.3）

- [x] 三阶段编排（证据 / 诊断 / 内容）
- [x] Budget / Failover / Risk / Verifier / Final Guard
- [x] Adaptive Payload Compaction
- [x] MIC editor field recovery + Kimi normalize（v1.6.3）

## 下一阶段（未开始，需最终验收后）

- Step 17 批量 / 整店体检
- 自动写回 MIC
- CRM / 询盘 / WhatsApp / 邮件自动跟进

## 本轮未删 / 部分接线

- `extractFields` / `extractOne` 仍保留供双轨对比，已离开 AI payload 主路径
- Keywords 独立 orch stage 仅在 CUSTOM/HYBRID scheduler 路径完整；默认 AUTO 仍并入 diagnosis
- Economy `maxCalls` 保持 2（规格建议 2–3，兼容既有 budget 测试）

## v1.7 技术债（本轮不修）

- 存量 overview / truth / keywords / content / debug 仍用 `esc()` + `innerHTML`，不强制迁到 `dom.js`
- CRM / 询盘 / WhatsApp / 企业微信 / SaaS / 批量诊断 / 新 Agent
