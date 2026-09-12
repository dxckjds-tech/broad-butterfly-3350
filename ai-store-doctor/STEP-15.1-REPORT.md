# AI 店铺医生 v1.6.1 — Step 15.1

Model Capability Hardening。未进入 Multi-Model Orchestration。

Commit：`fix: harden model capabilities and task validation`

## 1 Provider / Model 能力边界

Provider Registry 只保留平台元数据 `platformCapabilities`（`mayOfferVision` / `mayOfferReasoning` / `mayOfferLongContext` / `mayOfferStructuredOutput`），以及 API 风格、Adapter、默认模型、是否支持模型列表。

Provider 不再声明可被未知模型继承的 `vision` / `reasoning` / `longContext`。

Model 最终优先级：

```text
用户明确 Override
>
KNOWN Model 表
>
可信 Model metadata
>
启发式判断
>
安全默认
```

未知模型安全默认：`text=true`，`vision=false`，`reasoning=false`，`longContext=false`，`structuredOutput=false`。

`structuredOutput=true` 必须来自已知表、可信 metadata 或用户声明，不能因为 OpenAI-compatible 就假定支持。

## 2 Unknown 模型测试

| Provider | Model | vision | reasoning |
| --- | --- | --- | --- |
| qwen | `qwen-future-unknown` | false | false |
| moonshot | `kimi-future-unknown` | false | false |
| openai | `gpt-future-unknown` | false | false |

OpenAI 的平台 metadata 仍可 `mayOfferVision=true`，但 `gpt-future-unknown` 不得因此得到 `vision=true`。

用户明确 `Vision=true` 时，Override 生效。

## 3 response_format 测试

Adapter / AI Client 仅在 `capabilities.structuredOutput === true` 时发送 `{ response_format: { type: "json_object" } }`。

Custom A（`structuredOutput=false`）：请求体无 `response_format`。  
Custom B（`structuredOutput=true`）：允许 JSON mode。

Gemini 的 `responseMimeType=application/json` 同样受该开关控制。

## 4 Vision 双保护

1. Router 按 Task Profile 过滤。
2. 发送前 `executeOnRouted` 再检查 `capabilities.vision === true`。
3. OpenAI-compatible / Anthropic / Gemini Adapter 在 `vision !== true` 时剥离 `image_url`。

可文本降级的任务自动去图。`vision_analysis` 返回 `UNSUPPORTED_CAPABILITY`。

`selectModel()` 的 `capabilities` 经 `resolveRouted()` 复制到 `primary.capabilities`，`executeOnRouted()` 可读取 `selected.capabilities`。备用模型同样复制 fallback capabilities。

`thinking` / `reasoning_effort` / `response_format` / 视觉 payload 由 Adapter + Capabilities 决定，不再按 Provider 名字猜测。

## 5 Task validator fail-closed

`ASD.taskValidators` 不可用时立即 `TASK_VALIDATOR_UNAVAILABLE`，`connection_test` / `translation` 不得 raw 放行，且不得发起 fetch。

商品诊断仍走 Task Validator **和** 现有 Result Schema，Schema 未放松。

## 6 Custom 测试

- Custom A：Chat Completions 兼容，但 `structuredOutput=false` → 无 `response_format`
- Custom B：`structuredOutput=true` → 可发 JSON mode
- Custom C：`vision=false`，上下文有图 → 最终 Adapter request 无 `image_url`

## 7 Regression

新增 `tests/step15.1-capability-hardening.mjs`，覆盖 Unknown Capability、Custom structuredOutput、Vision 双保护、Task Validator unavailable、Router 未知/已知视觉选择。

旧测试保留。`DEFAULT_SCORES` 未改。`optional_host_permissions` 仍为 `https://*/*`。PRIVACY / README 已写明该权限只用于用户主动配置并授权的 Custom AI API Origin。

## 8 Multi-Model Orchestration

**否。** 本轮只修 Capability 正确性与 Task 安全回退。不要进入多模型编排、failover 或评分体系调整。
