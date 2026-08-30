# Scoring rules (Phase 1)

Rules live in `packages/scoring-rules` and are executed by `services/mic-rule-engine`.

Each dimension starts at 100. Failed rules deduct:

- CRITICAL: -20
- HIGH: -12
- MEDIUM: -6
- LOW: -3

Weighted total:

- MIC SEO 25%
- Google SEO 20%
- GEO 20%
- Content 20%
- B2B conversion 15%
