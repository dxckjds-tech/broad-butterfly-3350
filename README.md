# 外贸 AI 店铺医生（Trade AI Store Doctor）

Phase 1 基础框架：Chrome/Edge 插件 + React Admin + NestJS API + PostgreSQL + Redis。

当前重点平台：**Made-in-China.com / 中国制造网**。诊断引擎与平台无关，平台差异通过 Adapter 接入。

## 当前已完成

- Monorepo（pnpm workspace + Turborepo）
- Manifest V3 浏览器插件（Content Script / Background / Side Panel / Popup 降级）
- MIC 页面识别与容错解析（`packages/platform-adapters`）
- 规则引擎评分（非随机、非真实 AI）
- `POST /api/diagnosis/page` 诊断并写入数据库
- Admin 仪表盘 / 店铺 / 产品 / 报告 / 规则中心
- GEO / SEO / LLM 模块接口与 Mock Provider

## Mock / 预留

- `LLM_PROVIDER=mock`（OpenAI / Claude / Gemini / DeepSeek / Qwen 仅占位）
- GEO / SEO 引擎仅接口 + 启发式结果
- 插件「AI生成 / 复制建议 / 查看详情」按钮禁用
- Admin「重新诊断」禁用
- GEO 分析、系统设置页面为 Coming Soon
- 认证 / 支付 / 多租户未实现

## 环境要求

- Node.js 20+
- pnpm 10+
- Docker Desktop（PostgreSQL 16 + Redis 7）
- Chrome 或 Edge（加载未打包扩展）

## 目录结构

```
apps/extension    浏览器插件
apps/admin        管理后台
apps/api          NestJS API
packages/         shared-types / scoring-rules / prompts / platform-adapters
services/         diagnosis-engine / mic-rule-engine / seo-engine / geo-engine / ai-engine
docker/           Nginx 预留
```

## 安装与启动

```bash
pnpm install
cp .env.example .env
cp .env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/admin/.env.example apps/extension/.env

docker compose up -d

pnpm db:generate
pnpm db:migrate
# 若交互式 migrate 不便，可用：
# pnpm db:push

pnpm dev
# 或分别启动
pnpm dev:api
pnpm dev:admin
pnpm dev:extension
```

其他命令：

```bash
pnpm db:studio
pnpm build
pnpm typecheck
```

## 地址

| 服务 | 地址 |
| --- | --- |
| API | http://localhost:3000/api |
| Health | http://localhost:3000/api/health |
| 诊断 | POST http://localhost:3000/api/diagnosis/page |
| Admin | http://localhost:5173 |
| 本地 MIC 演示页 | http://localhost:5173/demo/mic-product.html |

## 加载 Chrome 插件

Chrome 文件选择器里请选仓库根目录的 **`AI-店铺医生-插件`**（里面有 `manifest.json`）。

不要选 `apps/extension`，那是源码，加载会失败。

```bash
pnpm --filter @trade-ai/extension build
# 会打印可加载的完整路径，并复制到：
#   ./AI-店铺医生-插件
#   ~/AI-店铺医生-插件
```

1. 打开 `chrome://extensions`
2. 开启「开发者模式」
3. 「加载已解压的扩展程序」
4. 选择 `AI-店铺医生-插件`
5. 打开 Made-in-China.com 产品页，或 http://localhost:5173/demo/mic-product.html
6. 点击工具栏图标打开 Side Panel，点「开始诊断」

更短说明见仓库根目录 `如何加载插件.md`。

## 数据库表

`User` `Shop` `Product` `DiagnosisReport` `DiagnosisScore` `DiagnosisIssue`

## 插件入口

- Content Script：`apps/extension/src/content/index.ts`
- Background：`apps/extension/src/background/index.ts`
- Side Panel：`apps/extension/src/pages/sidepanel/`
- Popup 降级：`apps/extension/src/pages/popup/`

## 下一阶段建议

1. 真实 MIC 页面选择器校准与回归用例
2. 接入真实 LLM（按 `LLMProvider` 切换）
3. GEO / AI Visibility 深度检测
4. Google SEO 与独立站 Adapter
5. 账号体系与店铺归属
6. 插件内一键生成优化文案
