# AI 店铺医生 v1.6.0 RC — Step 13–14

## 1 Git 提交

- `22be28b` feat: add MutationObserver collect with quality score
- `0eb3f63` chore: prepare v1.6.0 RC version, privacy, and pack
- plus follow-up fix commits on this branch for content-script globalThis and live-AI sandbox

## 2 Step 13 动态采集

- MutationObserver 只绑 `productRoot`，不绑 `document.body`
- debounce 400ms
- 轮询兜底最多 6 次、间隔 800ms；已完整页面约 400ms 结束
- 质量分：名称 20 / 类目 10 / 关键词 10 / 规格最多 25 / 描述 15 / productRoot 10 / 图片 10
- 无 root 时两次确认后结束，不空等
- 性能字段：`readDurationMs` `sampleCount` `observerTriggeredCount` `finalQualityScore`

## 3 Selector Hits（fixture 01 MIC）

- title: `h1`
- category: `.category-breadcrumb`
- keywords: `.keyword-tag`
- description: `null`（来自 JSON-LD / meta，不是 DOM selector）
- specifications: `table tr`
- company: `[class*="company-profile" i]`
- productRoot: `.product-main`

## 4 Step 14 版本

- manifest `1.6.0`
- `EXTENSION_VERSION` `1.6.0`
- `PROMPT_VERSION` `1.6.0`（独立字段）
- `SCHEMA_VERSION` `1`
- `SCORE_VERSION` `1.0`

## 5 权限

- permissions: `sidePanel` `storage` `activeTab`
- host_permissions: `*.made-in-china.com` `*.vemic.com` `api.deepseek.com` `api.moonshot.cn`
- CSP: `script-src 'self'; object-src 'self'`
- 未增加 tabs / scripting / cookies / webRequest / `<all_urls>`

## 6 Privacy

新增 `PRIVACY.md`：采集范围、发送到 DeepSeek/Kimi、程序化过滤、API Key 本机存储、历史本机存储、视觉图片、用户控制。

## 7 README

重写为产品说明 / 支持页面 / 功能 / 安装 / API / 隐私 / 权限 / 已知限制。

## 8 Kimi 默认模型

统一为 `kimi-k2.5`，唯一来源 `shared/constants.js` `DEFAULTS.kimiModel`。

## 9 Regression

`npm run regression` 全部 PASS（Step 0–14 离线套件 + pack）。

## 10 DeepSeek 真实测试

PASS。MIC fixture 身份 `Canister Vacuum Cleaner 20L` confidence 85，9 facts，health 83。VEMIC fixture 身份标注 Steam 未验证，confidence 40，12 facts，health 62。Payload 无测试 PII 原文。

## 11 Kimi 真实测试

PENDING（环境无 `KIMI_API_KEY`）。

## 12 Chrome 人工流程

Side Panel 采集不完整提示已用 jsdom boot 验证，分析按钮仍可用。未在本环境对真实 MIC/VEMIC 登录页做完整 Chrome 点击流。

## 13 打包

`dist/AI-Store-Doctor-v1.6.0-rc1.zip` 55 个文件。不含 `tests/` `node_modules/` `.git/` 报告 md / TODO / scripts。

## 14 当前 TODO

- Kimi 真实 MIC+VEMIC
- 视觉 Logo-first 真页
- RC 人工 5–10 个品类
- CWS
- v1.7：存量 innerHTML 迁移（不在本轮）

## 15 是否可以创建 v1.6.0-rc1

YES。不要创建 `v1.6.0` 正式 tag。Kimi 真实测试仍是正式版门槛。
