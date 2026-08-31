# Architecture

Phase 1 uses a **platform adapter** architecture. The diagnosis engine is platform-independent.

```
Browser page
  -> Content Script
  -> packages/platform-adapters (MadeInChinaAdapter)
  -> PlatformPageData
  -> POST /api/diagnosis/page
  -> services/diagnosis-engine
       -> services/mic-rule-engine
       -> packages/scoring-rules
       -> services/seo-engine (interface)
       -> services/geo-engine (interface)
  -> PostgreSQL (DiagnosisReport / Score / Issue)
  -> Extension / Admin UI
```

Future platforms (Alibaba, independent sites) only require a new adapter under `packages/platform-adapters`.
