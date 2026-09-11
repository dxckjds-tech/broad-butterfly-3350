# AI 店铺医生 — DeepSeek / Kimi 浏览器扩展

完整的 Chrome / Edge Manifest V3 侧边栏扩展。它通过商品 URL 读取 VEMIC 及 Made-in-China 页面字段，并调用 DeepSeek 或 Kimi API 完成诊断。

## 技术栈

- Chrome/Edge Manifest V3、Side Panel API
- 原生 HTML / CSS / JavaScript（无构建依赖）
- DeepSeek / Kimi OpenAI-compatible `POST /chat/completions`
- JSON Output 结构化响应
- `chrome.storage.local` 保存配置

## 功能

- 自动读取商品标题、类目、关键词、规格、认证、描述与商品图片链接
- 读取商品页 JSON-LD、规格表、定义列表和最多 30,000 字正文证据
- 支持直接粘贴商品 URL，由扩展请求并解析页面，无需逐个打开商品页
- 登录后台 URL 使用浏览器现有登录会话在后台标签页读取；会话失效时自动打开真实登录页，不保存账号密码
- DeepSeek 或 Kimi 商品身份候选与置信度分析
- 视觉模型直接识别图片像素，不以文件名或 Alt 文本判断商品
- 图片 URL、文件名及上传控件值会在文本提示中剔除，视觉证据统一标记为“图片视觉识别”
- 提供多个商品身份候选，用户确认后按正确身份重新分析
- 详情内容使用概览、重点、参数表、应用、包装交付等结构化排版
- GEO 同时约束产品事实和页面中的真实公司情况
- 每个纯英文内容卡片提供按需中文翻译按钮
- 中文输出诊断、风险原因和操作建议；英文输出可直接替换的商品文案
- 所有事实与卖点必须引用页面真实字段；缺少证据时返回 UNKNOWN / NOT_AVAILABLE
- VERIFIED / OBSERVED / INFERRED / UNKNOWN 事实台账
- 冲突及不可靠关键词拦截
- 标题、详情、FAQ、GEO 内容建议
- Token 用量、缺失字段和风险警告
- API 配置与连接测试

## 安装

1. 解压 ZIP。
2. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择 `ai-store-doctor-deepseek` 文件夹。
5. 点击扩展图标打开右侧栏。
6. 点击右上角“API 设置”，选择 DeepSeek 或 Kimi，填写对应 API Key 并测试连接。
7. 粘贴商品 URL 后点击“读取 URL”，再点击“AI 分析商品”。登录后台会复用浏览器登录会话；会话失效时自动打开真实登录页。

## 配置

DeepSeek 默认地址为 `https://api.deepseek.com`；Kimi 默认地址为 `https://api.moonshot.cn/v1`。两个提供商的密钥分开保存在扩展本地存储中。

API Key 首次输入后会自动保存。切换 AI 提供商、模型或思考模式不会清空任何已保存密钥；空白密码框也不会覆盖已有密钥。

Kimi 模型权限因账号和区域而异。设置页可调用 `/models` 获取当前 Key 实际可用的模型列表，也允许直接输入模型 ID。

AI 返回空内容或无效 JSON 时会自动重试最多 3 次；最后一次会退出 JSON Output 模式并从普通文本中提取 JSON。

URL 读取采用先注册加载监听、再导航后台标签页的方式；页面完成后最多等待内容脚本 10 次，避免页面加载与脚本注入的时序竞争。

快速诊断最多发送 30,000 字符证据、输出约 2,800 Token；单次请求和重试共享 55 秒总时限，侧边栏实时显示等待秒数。

对 `kimi-k2.5` 结构化诊断会显式关闭思考模式，避免输出额度被 reasoning 消耗；同时兼容字符串和内容块数组两种响应格式。

支持 Kimi K3，API 模型 ID 为 `kimi-k3`。K3 商品诊断使用顶层 `reasoning_effort: low`，以兼顾结果质量和响应速度；账号没有 K3 权限时仍需从“获取账号可用模型”返回的列表中选择其他模型。

VEMIC 动态编辑页会持续采样最多 10 秒，选取字段最完整的一次结果；支持同源 iframe、表格、定义列表、输入框、下拉框、文本域及图片文件名证据。

GEO 内容基于页面已验证事实生成英文问答或摘要，不再强制依赖外部搜索数据；仍禁止伪造排名、热度和未经验证的性能声明。

Kimi 请求固定使用其模型要求的 `temperature: 1`；DeepSeek 使用 `temperature: 0.2`。

## 数据与安全

扩展只会将商品字段发送给当前选择的 DeepSeek 或 Kimi，不会同时发送给两个提供商。生产环境若有多人使用，建议改用自有后端代理保管密钥。

## 文件结构

```
manifest.json
shared/
  constants.js          域名、模型默认值、版本号
  storage-keys.js       配置键与 hist: 命名约定
  types.js              JSDoc 类型
  dom.js                安全 DOM 构造器（新增 UI 使用）
background/
  service-worker.js     唯一 onMessage 入口 + importScripts
  message-handler.js
  settings.js
  model-router.js
  prompt-builder.js
  payload-builder.js
  image-fetcher.js
  ai-client.js
  url-reader.js
  request-registry.js   Step 9 占位
content-script.js
sidepanel.html
sidepanel/
  state.js
  actions.js
  app.js
  render/
options.html / options.js
styles.css
icons/
tests/                  不打包进扩展
TODO-v1.6.md
```

## 技术验证说明

已提供 Manifest、脚本语法及消息链路的离线校验。真实 API 连通性需要用户自己的 DeepSeek 或 Kimi API Key，可在设置页执行连接测试。
