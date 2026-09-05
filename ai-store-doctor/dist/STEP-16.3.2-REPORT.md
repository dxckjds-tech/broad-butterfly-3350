# AI 店铺医生 v1.6.3 — Step 16.3.2

Adaptive Payload Compaction & Error UX.

Commit: `fix: compact oversized payloads before enforcing input budget`

`PAYLOAD_BUDGET_EXCEEDED` no longer aborts on the first over-budget estimate. The builder runs deterministic FULL → COMPACT → MINIMAL compaction, re-estimates after each profile, and only fails after MINIMAL still exceeds the input budget.

Do not start Step 17.

---

1. Compactor: `shared/payload-compactor.js`. Fixed order: drop debug → dedupe → limit company → paragraph-clip description → rank/keep core specs → dedupe/limit keywords → limit applications/certifications → reduce images → shrink fallbackText last.
2. Always kept: `product.name`, `category`, `model`, `sku`, `material`, `power`, `voltage`, `capacity`, `moq`, `current.title`, `current.keywords`, high-confidence specs, VERIFIED page facts.
3. No `JSON.stringify(...).slice(...)`. Structure first, then stringify + parse-check.
4. Profiles: FULL → COMPACT → MINIMAL. Debug: `payloadProfile`, `originalEstimatedTokens`, `finalEstimatedTokens`, `removedSections`, `removedCounts`, `imageCountBefore`, `imageCountAfter`. No raw payload text in debug.
5. MINIMAL still over message: `商品信息过长，已自动压缩但仍超过当前模型输入预算。请切换支持更长上下文的模型或减少分析内容。`
6. CTA by code:
   - AUTH_ERROR / API_KEY_MISSING → 打开 API 设置
   - MODEL_NOT_FOUND → 打开模型设置
   - PAYLOAD_BUDGET_EXCEEDED → 重新压缩并分析 / 切换模型
   - COLLECTION_INCOMPLETE → 重新读取页面
7. Collection warning Debug: `productRootFound`, `finalQualityScore`, `selectorHits.title/category/specifications/description`.
8. “重新读取页面” force-resamples, bumps `fieldsVersion` first, keeps MutationObserver.
9. Tests: `tests/step16-payload-compact.mjs`. Full `npm run regression` PASS.
10. Unchanged: Provider Router, Model Health, Verifier, Risk Score, Final Guard, Claim ID, History shape, Permissions.

## Downloads

- Extension zip: https://raw.githubusercontent.com/dxckjds-tech/broad-butterfly-3350/cursor/v16-step16-payload-compact-2c46/dist/AI-Store-Doctor-v1.6.3-rc1.zip
- This report: https://raw.githubusercontent.com/dxckjds-tech/broad-butterfly-3350/cursor/v16-step16-payload-compact-2c46/dist/STEP-16.3.2-REPORT.md
