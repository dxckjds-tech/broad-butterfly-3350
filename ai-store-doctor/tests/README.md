# Offline fixtures (v1.5.1 baseline)

These HTML samples are synthetic and sanitized. They do **not** come from a logged-in VEMIC/MIC backend.

| File | Scenario |
|---|---|
| `01-mic-product-detail.html` | Public-style MIC product detail (JSON-LD + table + dl) |
| `02-vemic-product-edit.html` | VEMIC-style product edit form |
| `03-vemic-product-list.html` | Non-product list page (negative sample) |
| `04-dynamic-product-page.html` | Sparse/loading product page |
| `05-special-jsonld-iframe.html` | JSON-LD array `@type` + empty iframe |

`*.baseline.fields.json` is `state.fields` from v1.5.1 `extractFields()` (jsdom), with `readAt` removed because it is a timestamp.

`*.baseline.report.json` is `state.report`. v1.5.1 only fills this after a live `ANALYZE_PRODUCT` call, so the frozen value is `null`.

`*.baseline.compact.json` is the `compactFields` payload that `ANALYZE_PRODUCT` would send (string truncation applied later in background). Used to prove payload assembly did not change during refactors.

`npm run regression` also boots the service worker, side panel, and options page in Node (chrome mock) to catch `ASD.xxx is undefined` and script-order mistakes.

```
cd tests && npm install && npm run regression
```

`--write` regenerates field/report/compact baselines. Do not use it after Step 1 unless the extractor is supposed to change.
