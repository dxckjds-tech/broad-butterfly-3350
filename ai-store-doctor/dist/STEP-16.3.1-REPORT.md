# AI 店铺医生 v1.6.3 — Step 16.3.1

Budget Enforcement & Verification Identity Hardening.

Commit: `fix: enforce orchestration budgets and stable verification claim ids`

Pricing unchanged: `pricingVersion=2026-03-registry-v1`, `sourceDate=2026-03-01`.

`REAL_MULTI_PROVIDER_PENDING` until a second live provider key is present.

Code is ready for final dual-provider acceptance. Do not start Step 17.

---

1. Cost hard limit: `addUsage()` no longer throws. It marks `costExceeded` / `exhaustedReason=COST_BUDGET_EXCEEDED`, keeps the current validated response, and `canCall()` returns false so Stage 2/3/verifier cannot start.
2. Token hard limit: after `addUsage()`, `inputTokens > maxInputTokens` → `TOKEN_INPUT_BUDGET_EXCEEDED`; `outputTokens > maxOutputTokens` → `TOKEN_OUTPUT_BUDGET_EXCEEDED`. Current output is kept; later AI calls are blocked.
3. Request `maxTokens` is `min(stageMaxTokens, remainingOutputTokens)`. If remaining output budget is 0, the request is not sent.
4. Production `replanAfterFailure()` call sites: after evidence, before merged/diagnosis/content, after diagnosis, on budget-blocked later stages, and after single-mode failover. Debug: `orchestration.replans[]` = `{ trigger, beforeCalls, remainingCalls, action, reason }`.
5. Replan tests: failover records `trigger=FALLBACK_USED` on the production planner; cost/token exceed records `action=partial` and does not continue later stages. `merged_to_fit_budget` still executes the returned stages.
6. Deterministic `claimId` = `normalizedField|normalizedValue|sourceType|sourceRef` (example `power|1500w|vision|image-2`). No `Math.random`. 20/20 identical.
7. Same-field multi-claim: `Certification=CE` kept when verifier rejects only `Certification=UL`. Page `Power=1200W` and vision `Power=1500W` have distinct identities; decisions apply by exact `claimId`.
8. Step 0–16.3.1 regression: run `npm run regression` in `ai-store-doctor/tests`.
9. `REAL_MULTI_PROVIDER_PENDING`.
10. Yes — code is ready for final dual-provider acceptance. Do not start Step 17.
