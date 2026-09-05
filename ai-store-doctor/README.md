# AI 店铺医生

Chrome Manifest V3 侧边栏扩展。它读取 Made-in-China / VEMIC 商品页字段，调用 DeepSeek 或 Kimi 做商品诊断和内容优化。

当前版本：`1.6.0`（发布候选，以 `EXTENSION_VERSION` 为准）。  
Prompt 版本：`1.6.0`（独立字段，不与扩展版本混用）。

## 产品说明

AI 店铺医生帮助跨境卖家检查商品页事实是否完整、标题和关键词是否有证据、以及内容是否值得改。它不是 CRM、询盘或自动跟进工具。

## 支持页面

- Made-in-China 商品详情
- VEMIC 商品编辑页

仅上述 HTTPS 域名。不会申请 `<all_urls>`。

## 功能

- 商品字段提取（双轨 `fields` + `product`）
- MutationObserver + 低频轮询的动态页采集
- AI 诊断
- 商品事实台账（VERIFIED / OBSERVED / INFERRED / UNKNOWN）
- 确定性健康评分
- 关键词建议与拦截
- 内容优化（标题 / 详情 / FAQ / GEO）
- 当前 VS 建议
- 历史诊断（本机最多 100 条）

## 安装

1. 解压发布 ZIP。
2. Chrome 打开 `chrome://extensions`。
3. 开启开发者模式。
4. 点击“加载已解压的扩展程序”，选择解压后的扩展根目录（含 `manifest.json`）。
5. 点击扩展图标打开 Side Panel。
6. 打开“API 设置”，选择 DeepSeek 或 Kimi，填写 API Key 并测试连接。
7. 粘贴商品 URL 后点“读取 URL”，或在商品页点“读取当前页 URL”，再点“AI 分析商品”。

## API 设置

默认提供商是 DeepSeek。

- DeepSeek 默认地址：`https://api.deepseek.com`
- DeepSeek 默认模型：`deepseek-v4-flash`
- Kimi 默认地址：`https://api.moonshot.cn/v1`
- Kimi 默认模型：`kimi-k2.5`（唯一默认来源：`shared/constants.js`）

API Key 保存在 `chrome.storage.local`。切换提供商不会清空另一套 Key。

## 隐私

详见 [PRIVACY.md](PRIVACY.md)。

扩展会在用户主动分析时读取商品字段和图片，发送给当前选择的第三方 AI。发送前做程序化敏感信息过滤，但不承诺“绝对不会发送任何个人信息”。

## 权限

`permissions`：`sidePanel`、`storage`、`activeTab`  
`host_permissions`：`*.made-in-china.com`、`*.vemic.com`、`api.deepseek.com`、`api.moonshot.cn`

没有 `tabs`、`scripting`、`cookies`、`webRequest`、`<all_urls>`。

## 已知限制

- 真实 AI 回归依赖本机或环境中的 API Key。没有 Key 时离线测试仍可通过，但 `REAL_AI_REGRESSION` 保持 PENDING。
- 存量概览 / 真相 / 关键词 / 内容 / 调试页仍使用 `esc()` + `innerHTML`。v1.6 不强制迁到 `dom.js`，记为 v1.7 技术债。
- 动态后台页的稳定时间随网络和站点性能变化；验收看字段召回，不把“2 秒”写成硬失败。
- 本扩展不包含 CRM、询盘、WhatsApp、企业微信、SaaS 或批量诊断。

## 开发测试

```bash
cd tests
npm install
npm run regression
```

`tests/` 和 `node_modules/` 不进入正式扩展 ZIP。

发布打包：

```bash
node scripts/pack-extension.mjs
```
