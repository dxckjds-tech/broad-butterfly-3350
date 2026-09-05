# AI 店铺医生 v1.6.3 — Step 16.3.3

MIC Editor Field Recovery + Kimi Response Normalization.

Commit: `fix: recover MIC editor fields and normalize kimi responses`

Do not start Step 17.

---

1. MIC membercenter title/category selectors live in `content/field-map.js` only.
2. Title priority: product/title input → label control → initial state / JSON → low-confidence fallback. `h1` is last, not first.
3. Category priority: selected category → select / hidden → breadcrumb → initial state / JSON.
4. Lookup stays inside `productRoot` / the product edit form. No `document.body` fallback.
5. `selectorHits` records the actual selector/source (`input[name="prodName"]`, `.cate-selected`, `label:…`, `json:prodName`).
6. Fixture `10-mic-membercenter-edit.html`: title and category hit, `finalQualityScore=90` (was 60 without those fields), specifications stay `table tr`, description stays `textarea[name*="desc" i]`.
7. Shared `normalizeResponse` for connection_test / translation / product_diagnosis.
8. Compatible with string content, array text parts, and documented final-text fields. `reasoning_content` is never treated as the final answer.
9. `finish_reason=length` → `LENGTH_ERROR`. `finish_reason=stop` + empty content → `RESPONSE_ERROR` with safe metadata.
10. Response debug: provider, model, httpStatus, finishReason, choicesCount, contentType, contentLength, hasReasoningContent, topLevelKeys, messageKeys. No API Key, Authorization, raw response, prompt, or product text.
11. Unchanged: Budget, Router, Verifier, Risk Engine, Final Guard, Provider permissions, History shape.
12. Full `npm run regression` PASS.

## Downloads

- Extension zip: https://raw.githubusercontent.com/dxckjds-tech/broad-butterfly-3350/cursor/v16-step16-mic-kimi-2c46/dist/AI-Store-Doctor-v1.6.3-rc1.zip
- This report: https://raw.githubusercontent.com/dxckjds-tech/broad-butterfly-3350/cursor/v16-step16-mic-kimi-2c46/dist/STEP-16.3.3-REPORT.md
