# AI 店铺医生 隐私说明

本文说明扩展实际做什么。不是营销文案。

## 采集什么

用户主动读取或分析商品页面时，扩展会读取与商品相关的：

- 商品标题
- 分类
- 关键词
- 产品参数
- 描述
- 公司信息
- 商品图片

扩展不会在启动后自动分析当前页面。

## 为什么采集

这些字段用于 AI 商品诊断和内容优化，包括商品事实、健康评分、关键词建议、标题/详情建议，以及当前内容与建议的对比。

## 发送到哪里

用户主动分析时，页面数据可能发送给**用户已配置且启用**的 AI Provider，而不是所有列出的厂商。可能的目标包括：

- DeepSeek（`api.deepseek.com`）
- Moonshot / Kimi（`api.moonshot.cn`）
- OpenAI（`api.openai.com`）
- Anthropic / Claude（`api.anthropic.com`）
- Google Gemini（`generativelanguage.googleapis.com`）
- Qwen（`dashscope.aliyuncs.com`）
- 用户填写的 Custom OpenAI-Compatible 地址

**只会调用用户已配置且启用的 Provider。** 未填写 API Key 或未启用的 Provider 不会收到数据。

智能自动模式下，一次任务通常只调用路由器选中的一个 Provider；当前版本不会把同一次诊断并行发给多个厂商。当前版本不会把商品数据上传到 AI 店铺医生自有服务器。

## 隐私过滤

发送前，程序会过滤邮箱、电话、Token 等敏感信息。

系统采取程序化过滤措施减少不必要的敏感信息传输。这不是“绝对不会发送任何个人信息”的保证：页面原文里仍可能残留未被规则识别的个人信息。

## API Key

API Key 保存在当前浏览器的 `chrome.storage.local`。

当前版本不会把 API Key 上传到 AI 店铺医生自有服务器。调用第三方 AI API 时会使用该 Key。

用户可以在设置页清空或改写 Key，也可以卸载扩展删除本地存储。

## 历史报告

历史诊断默认保存在用户本机 Chrome Extension storage（`hist:idx` / `hist:<id>`）。

历史记录不上传到 AI 店铺医生自有服务器。用户可以在侧边栏删除单条或清空历史。

保存历史前会再次做安全过滤。若过滤模块不可用，扩展拒绝保存，不会静默写入未脱敏内容。

## 认证图片 / 视觉诊断

如果启用视觉诊断，插件可能读取已登录页面中的商品图片，筛选后发送给用户选择的 AI 模型用于视觉分析。

扩展按商品相关度排序图片，避免优先发送 Logo 或认证章。被拒绝的图片不会以原始 URL 进入视觉请求。

## 用户控制

- Side Panel 不会在启动后自动分析
- 用户需要主动点击读取 / 分析
- 用户可删除历史报告
- 用户可以移除 API Key
- 采集不完整时会提示，但不阻断用户继续分析

## 可选主机权限

`optional_host_permissions` 中的 `https://*/*` **不是**扩展默认可以访问任意网站。

该条目只用于：用户在设置页主动填写 Custom OpenAI-Compatible Base URL，并在浏览器权限提示中明确授权之后，扩展才能访问**该 Custom AI API Origin**。未配置、未授权的源不会被调用。官方 Provider 使用 `host_permissions` 中列出的固定 API 主机。
