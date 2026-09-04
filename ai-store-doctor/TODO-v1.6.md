# TODO v1.6（Step 0–3 发现，本轮未修）

以下问题在架构审查或本次重构中确认存在。按指令记录在此，不在 Step 0–3 顺手修复。

## 采集 / 数据

- [ ] P0-1 `visibleText` / `formFields` 无 PII 脱敏，整页文本可发往 DeepSeek/Kimi（Step 5）
- [x] P0-2 新采集器不再静默退回 `document.body`；旧 `fields.visibleText` 仍保留兼容（Step 4）
- [x] password 隐藏弹窗不再误判 loginRequired（Step 4）
- [x] 新采集器对 span/div 关键词 chip 使用 textContent（Step 4；旧 fields 仍为空以保持双轨）
- [x] `JSON.stringify(compactFields).slice(0, 30000)` 已删除，改为对象级预算（Step 6）
- [ ] REAL_AI_REGRESSION_PENDING：环境无 DeepSeek/Kimi Key，Step 6/7 未跑真实模型回归
- [x] `ANALYZE_PRODUCT` 有 requestId / inflight / registry 去重（Step 9）
- [x] `REQUEST_MIC_FIELDS` 作为当前页 L1 读取（Step 9）

## 配置

- [ ] Kimi 默认模型不一致：`settings()` 默认 `kimi-k2.5`，options 无保存时回退 `moonshot-v1-8k`。本轮有意保留两套值以免改变调用/UI。
- [x] `imageAsDataUrl` 已支持 apex + 子域（Step 8；未新增 host_permissions）
- [ ] options 页 `refreshModels` 仍对 datalist 使用 `innerHTML = ''`（清空子节点，无不可信插值）

## UI

- [ ] 存量 tab 仍用 `innerHTML` + `esc()`，尚未迁到 `shared/dom.js`（本轮只约束新增 UI）
- [x] 启动不再自动采集，只预填当前 URL（Step 9）
- [ ] `styles.css` 仍有未使用的 `.modal` 规则（对应已删除的 `#modal`）
- [x] `analyze()` 使用 requestId / fieldsVersion 丢弃乱序响应（Step 9）

## 不要在本文件对应的后续 Step 之前做

- 新白名单采集、PII sanitize、Prompt Injection 条款、Schema Validator
- 图片评分、并发控制、健康评分、历史报告、内容对比
- MutationObserver、CRM、询盘、SaaS
- 修改 `SYSTEM_PROMPT` 既有事实约束
- 新增 Chrome 权限
