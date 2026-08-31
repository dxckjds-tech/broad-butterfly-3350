# REFACTOR_REPORT.md

Universal Adaptive Product Reasoning MVP 审计与处理结果。生产路径不得返回演示搜索量、固定评分或演示推荐。

## 架构（落地后）

单向数据流：

```
页面文本 / 参数 / 表格 / 标题 / 类目 / 描述
        ↓
Universal Product Intelligence（ReasoningLoop ≤ 5）
        ↓
Product Truth Profile（V1 适配器 + 现有 inspect）
        ↓
Keyword Intelligence / 关键词门禁
        ↓
Validation → Title / Keyword Generator（DRY_RUN 建议）
```

SEO **不得**回写 Product Truth。`officialTop3` 仅在存在 VERIFIED 搜索证据时填充；当前环境搜索工具为 `UNAVAILABLE`，正式 Top3 恒为空。

## 生产路径扫描

| 位置 | 风险 | 处理 |
| --- | --- | --- |
| `packages/scoring-rules/src/engine/product-family.ts` `PRODUCT_FAMILY_CATALOG` | 高：按真空/蒸汽等具体产品词判定身份 | **保留为 V1 兼容层**，供现有 `inspectProductIdentity` / 关键词门禁使用。UPI 引擎 **不导入** 该目录，身份来自通用中心名词 n-gram。 |
| `packages/scoring-rules/src/engine/core-term.ts` `PRODUCT_NOUNS` | 中：含 vacuum cleaner 等具体名词 | **保留 V1**。UPI 使用 `GENERIC_HEAD_NOUNS` + 停用词，无具体 SKU 分支。 |
| `services/ai-engine/src/providers/mock.provider.ts` | 中：无 Key 时 mock LLM | **保留测试/降级**。`/ai/health` 会标 `mock`。生产有 DeepSeek 时不走 mock。Mock 不得生成搜索量。 |
| `services/ai-engine/src/tasks/optimize-keywords.ts` `officialTop3: []`, `searchDemand: 'UNKNOWN'` | 低：看似硬编码 | **正确行为**：无 VERIFIED 搜索证据不进正式 Top3，禁止伪造 CPC/搜索量。 |
| `apps/api/.../ai.service.ts` `gateKeywords` 返回 `officialTop3: []` | 低 | **保持**。生产 API 不发明搜索数据。 |
| `apps/admin/public/demo/*` | 中：演示 listing | **隔离**：仅 `/demo/` 静态页，不进入生产 API 响应。 |
| `apps/extension/src/services/demo-vo.ts` `DEMO_VO_PAYLOAD` | 中：合成 VO | **隔离**：注释标明 fixture，不作为诊断/UPI 生产数据源。 |
| `packages/scoring-rules/src/truth-gate.test.ts` 测试内 VERIFIED 搜索证据 | 低 | **仅测试**。生产 `missingSearchEvidence()` 不会注入数字。 |
| `services/diagnosis-engine` 原固定规则分 | 低：规则引擎扣分 | **保留**。UPI 置信度由 `UPI_CONF_1.0.0` 公式计算，不替代规则分，也不由 LLM 填写。 |
| 图片分析 / 搜索数据 | 高：若假装接通会伪造视觉事实与需求 | **接口 + UNAVAILABLE 降级**。`imageAnalyzer` / `searchDataProvider` 超时、重试一次、按输入哈希去重；失败返回 `UNAVAILABLE`，demand=`NOT_AVAILABLE`。 |

## 兼容方式

- **API**：原 `/ai/mic/product-identity`、关键词门禁、诊断接口字段保持。新增可选 `universalReasoning`，以及 `POST /ai/mic/universal-reason`。
- **数据库**：不新增必填列，UPI 结果不入库（避免破坏 Prisma 历史迁移）。
- **插件**：不替换「产品身份」侧边栏，新增「商品识别（自适应）」区块。
- **V1 适配器**：`toProductTruthProfile()` 供需要 ProductTruthProfile 的调用方；关键词门禁仍走 V1 `inspectProductIdentity`，避免破坏现有测试与插件。

## 核心算法约束

UPI 引擎源文件不得 `if/contains` 某个具体商品名来决定身份。具体产品名只出现在：

- `src/__tests__/fixtures.ts`（10 个跨品类 fixture）
- 本报告与示例
- 可配置通用词表（材质族、受保护属性、场景、中心名词），不含真空/CNC 等目录

TITLE / PRODUCT_NAME / KEYWORDS 均为 `SELLER_INPUT`。受保护属性、认证、材料、用途不得由关键词自证；仅 SPEC / DESCRIPTION / CERTIFICATION_FIELD / USER 可使声明进入 VERIFIED，且必须绑定 `evidenceIds`。

## 未实现（明确降级）

- 真实多模态图片分析
- 真实搜索量 / CPC / 热度指数
- 把 UPI 状态持久化到 Prisma
- 用 UPI 完全替换 V1 `PRODUCT_FAMILY_CATALOG`（下一阶段可开关迁移）
- 一键写回 MIC（继续 DRY_RUN）
