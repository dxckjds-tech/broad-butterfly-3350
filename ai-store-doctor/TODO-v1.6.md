# TODO v1.6（Step 0–3 发现，本轮未修）

以下问题在架构审查或本次重构中确认存在。按指令记录在此，不在 Step 0–3 顺手修复。

## 采集 / 数据

- [ ] P0-1 `visibleText` / `formFields` 无 PII 脱敏，整页文本可发往 DeepSeek/Kimi（Step 5）
- [ ] P0-2 `formFields` 抓全页控件；`visibleText` 可回退到 `document.body`（Step 4）
- [ ] 任意角落的 `input[type=password]` 会使整页采集返回 `loginRequired`（Step 4/9）
- [ ] 关键词选择器命中 span/div 时 `controlValue` 只读 `.value`，公开详情页 chip 常抽不到关键词（fixtures/01 已复现）
- [ ] `JSON.stringify(compactFields).slice(0, 30000)` 字符串截断可能切断 JSON（Step 6）
- [ ] `ANALYZE_PRODUCT` 无重入保护，可并发多次请求（Step 9）
- [ ] `REQUEST_MIC_FIELDS` 无 sidepanel 调用方，仍保留 handler

## 配置

- [ ] Kimi 默认模型不一致：`settings()` 默认 `kimi-k2.5`，options 无保存时回退 `moonshot-v1-8k`。本轮有意保留两套值以免改变调用/UI。
- [ ] `imageAsDataUrl` 只允许 `*.made-in-china.com` / `*.vemic.com` 子域，apex 域名 `made-in-china.com` / `vemic.com` 与 URL 读取白名单不一致
- [ ] options 页 `refreshModels` 仍对 datalist 使用 `innerHTML = ''`（清空子节点，无不可信插值）

## UI

- [ ] 存量 tab 仍用 `innerHTML` + `esc()`，尚未迁到 `shared/dom.js`（本轮只约束新增 UI）
- [ ] 启动仍自动 `read()` 当前页 URL（P1-1，Step 9）
- [ ] `styles.css` 仍有未使用的 `.modal` 规则（对应已删除的 `#modal`）
- [ ] `analyze()` 无 guard / requestId，迟到响可能覆盖新请求（Step 9）

## 不要在本文件对应的后续 Step 之前做

- 新白名单采集、PII sanitize、Prompt Injection 条款、Schema Validator
- 图片评分、并发控制、健康评分、历史报告、内容对比
- MutationObserver、CRM、询盘、SaaS
- 修改 `SYSTEM_PROMPT` 既有事实约束
- 新增 Chrome 权限
