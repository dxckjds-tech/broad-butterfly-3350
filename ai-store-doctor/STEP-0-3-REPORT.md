# AI 店铺医生 v1.6.0 Step 0–3 完成报告

日期：2026-09-04  
基线 tag：`v1.5.1-baseline`（commit `3bde5ef`）  
范围：仅 Step 0–3。未开始 Step 4–14。

本轮目标：在不改变现有业务功能和用户使用结果的前提下，把 v1.5.1 整理成可继续开发 v1.6 的稳定代码基础。

---

## 1. Git 提交列表

| Commit | 说明 |
|---|---|
| `3bde5ef` | 导入未改动的 v1.5.1 源码，打 tag `v1.5.1-baseline` |
| `b19a8cd` | Commit 1：冻结 5 份脱敏 HTML 样本，以及 `state.fields` / `state.report` / `compactFields` baseline |
| `4d52f86` | Commit 2：Prettier `printWidth: 120`；删除确认死代码；HTML 写最终按钮文案 |
| `0ed0df5` | Commit 3：`globalThis.ASD` + `shared/constants.js` + `jsconfig.json` |
| `cb6cc71` | Commit 4：拆分 `background.js` 为 classic service worker 模块，唯一同步 `onMessage` |
| `829730e` | Commit 5：settings 显式键读取 + SW 内存缓存；`shared/storage-keys.js` |
| `0dda22e` | Commit 6：拆分 `sidepanel.js` 为 state / actions / render(props) |
| `a69f057` | Commit 7：`shared/dom.js` + innerHTML 安全检查 + `TODO-v1.6.md` |
| `0921ee9` | 附加：Service Worker / Side Panel / Options 的 Node boot 测试，防止 `ASD.xxx is undefined` |

---

## 2. 删除的文件 / 代码

### 删除文件

- `background.js`（逻辑原样搬到 `background/`）
- `sidepanel.js`（逻辑原样搬到 `sidepanel/`）

### 删除死代码

- `sidepanel.js` 中的 `parseHtml()`：全项目无调用
- `sidepanel.html` 中的 `#modal`
- 启动时把「示例数据」改成「API 设置」、把分析按钮改成「AI 分析商品」的文字替换  
  现改为 HTML 直接写最终文案：`API 设置`、`AI 分析商品`，`data-action="settings"`

未删除：`styles.css` 里未使用的 `.modal` 规则（记入 TODO，本轮不顺手改样式）。

---

## 3. 新增文件

```
shared/constants.js
shared/storage-keys.js
shared/types.js
shared/dom.js
background/service-worker.js
background/message-handler.js
background/settings.js
background/model-router.js
background/prompt-builder.js
background/payload-builder.js
background/image-fetcher.js
background/ai-client.js
background/url-reader.js
background/request-registry.js   # Step 9 空骨架，无新功能
sidepanel/app.js
sidepanel/state.js
sidepanel/actions.js
sidepanel/render/helpers.js
sidepanel/render/overview.js
sidepanel/render/truth.js
sidepanel/render/keywords.js
sidepanel/render/content.js
sidepanel/render/debug.js
jsconfig.json
.prettierrc.json
.gitignore
TODO-v1.6.md
STEP-0-3-REPORT.md
tests/                          # 离线回归，不打进扩展运行时
```

未创建：`sidepanel/render/health.js`、`history.js`、`compare.js`（尚无功能，按指令不实现）。

---

## 4. 修改文件

- `manifest.json`：仅 `service_worker` 改为 `background/service-worker.js`。无 `type: module`。权限未变。
- `content-script.js`：仅格式化，采集逻辑未改。
- `sidepanel.html`：按钮最终文案、删除 `#modal`、按依赖顺序加载 script。
- `options.html` / `options.js`：加载 `shared/constants.js` + `shared/storage-keys.js`，用显式键读配置。
- `README.md`：补充当前目录结构。
- `styles.css`：未改。

权限仍为：`sidePanel` / `storage` / `activeTab`  
host_permissions 仍为：`*.made-in-china.com` / `*.vemic.com` / `api.deepseek.com` / `api.moonshot.cn`

---

## 5. 最终目录树

```
ai-store-doctor/
├── manifest.json
├── content-script.js
├── options.html
├── options.js
├── sidepanel.html
├── styles.css
├── jsconfig.json
├── README.md
├── TODO-v1.6.md
├── STEP-0-3-REPORT.md
├── icons/
├── shared/
│   ├── constants.js
│   ├── storage-keys.js
│   ├── types.js
│   └── dom.js
├── background/
│   ├── service-worker.js
│   ├── message-handler.js
│   ├── settings.js
│   ├── model-router.js
│   ├── prompt-builder.js
│   ├── payload-builder.js
│   ├── image-fetcher.js
│   ├── ai-client.js
│   ├── url-reader.js
│   └── request-registry.js
├── sidepanel/
│   ├── app.js
│   ├── state.js
│   ├── actions.js
│   └── render/
│       ├── helpers.js
│       ├── overview.js
│       ├── truth.js
│       ├── keywords.js
│       ├── content.js
│       └── debug.js
└── tests/                      # npm run regression；含 fixtures 与 boot 检查
```

加载顺序：

- Content：`content-script.js`（本轮不依赖 shared，故未三端强行加载）
- Background `importScripts`：constants → storage-keys → settings → model-router → prompt-builder → payload-builder → image-fetcher → ai-client → url-reader → request-registry → message-handler
- Side Panel：dom → state → render/helpers → overview/truth/keywords/content/debug → actions → app.js
- Options：constants → storage-keys → options.js

---

## 6. 基线回归

命令：`cd tests && npm install && npm run regression`

| 样本 | state.fields | state.report | compactFields |
|---|---|---|---|
| 01 MIC 商品详情页 | 与 baseline 一致 | `null`，一致 | 一致 |
| 02 VEMIC 商品编辑页 | 与 baseline 一致 | `null`，一致 | 一致 |
| 03 VEMIC 列表/非商品页 | 与 baseline 一致 | `null`，一致 | 一致 |
| 04 动态加载商品页 | 与 baseline 一致 | `null`，一致 | 一致 |
| 05 JSON-LD + iframe 特殊页 | 与 baseline 一致 | `null`，一致 | 一致 |

说明：

- `state.report` 基线为 `null`，因为 v1.5.1 只在真实 `ANALYZE_PRODUCT` 后才写入。本环境无 API Key，不能也不应伪造 AI 报告。
- `readAt` 时间戳不参与 fields 比较。
- `SYSTEM_PROMPT` 与 v1.5.1 字节相同（2933）。
- 存量 tab 渲染 HTML 与拆分前一致。商品真相页手动身份输入框多了 `value=""`（空值，不影响显示）。
- 架构 / innerHTML / dom / 旧配置兼容 / SW·Side Panel·Options boot 全部通过。无 `ASD.xxx is undefined`。

---

## 7. Chrome 测试

已用 Chrome 加载未打包目录 `/workspace/ai-store-doctor`（Manifest 合法，开发者模式）。

| 项 | 结果 |
|---|---|
| Extension load | 通过。名称「AI 店铺医生」，版本 1.5.1，无 Errors |
| Service Worker | 通过。`service-worker.js` 可检查，Console 无 error |
| Side Panel | 通过。5 个 tab、`API 设置`、`AI 分析商品`、空态文案与 v1.5.1 一致 |
| Options | 通过。DeepSeek / Kimi 面板切换、默认地址与模型回退正确 |
| DeepSeek | 无 Key 点「保存并测试」→「请输入 DeepSeek API Key」。未做真实 HTTP 调用 |
| Kimi | 无 Key 点「保存并测试」→「请输入 Kimi API Key」。未做真实 HTTP 调用 |
| 当前页读取 | 在 `chrome://extensions` 上得到「无法取得当前页面 URL」，与 v1.5.1 一致 |
| 用户旧设置 | Node smoke：旧 `apiKey` 仍映射到 DeepSeek 字段；扁平键未迁移 |

未做：带真实 Key 的 DeepSeek / Kimi 出网诊断。路由与缺 Key 行为已覆盖。

---

## 8. Console

- Service Worker DevTools：无 error / warning
- Side Panel / Options 加载：无 `ASD.xxx is undefined`
- 在 `chrome://` 页读取 URL：业务错误「无法取得当前页面 URL」，不是脚本异常

---

## 9. 已发现但未处理（见 `TODO-v1.6.md`）

- P0 整页采集 / 无 PII 脱敏
- password input 导致 `loginRequired` 误判
- 关键词 chip 抽不到（selector 命中 span 时只读 `.value`）
- `compactFields` 30,000 字符截断可能切断 JSON
- `ANALYZE_PRODUCT` 无重入保护
- Kimi 默认模型双值：`kimi-k2.5`（调用）vs `moonshot-v1-8k`（设置页未保存时），本轮有意保留
- 图片域名只认子域、不认 apex
- 存量 UI 仍用 `innerHTML` + `esc()`
- 启动仍自动 `read()` 当前页
- 残留 `.modal` CSS

---

## 10. 是否可以进入 Step 4

**YES**

理由：Step 0–3 已完成；fields / report / compact 与 v1.5.1 baseline 无业务 diff；权限、Prompt、采集逻辑未改；三端加载顺序通过；可解压加载。

限制：本环境没有真实 API Key，所以「AI 分析输出与线上基线逐字相同」只能由后续带 Key 的环境补测。缺 Key 路径与调用装配已验证。

本轮停止。不开始白名单采集、PII、Prompt Injection、Schema、图片评分、并发、健康分、历史、对比。
