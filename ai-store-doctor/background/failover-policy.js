/**
 * Bounded failover: at most primary + 1 fallback per stage.
 * Never vote. Never retry infinitely. SCHEMA_ERROR repairs same model first.
 */
(function initFailoverPolicy(global) {
  const ASD = (global.ASD = global.ASD || {});
  const bg = (ASD.bg = ASD.bg || {});

  const FAILOVER_ERRORS = new Set([
    "NETWORK_ERROR",
    "CONNECTION_ERROR",
    "RATE_LIMIT_ERROR",
    "TIMEOUT",
    "MODEL_NOT_FOUND",
    "PROVIDER_ERROR"
  ]);

  const NO_CROSS_MODEL = new Set([
    "AUTH_ERROR",
    "VALIDATION_ERROR",
    "EVIDENCE_CONFLICT",
    "UNSUPPORTED_CAPABILITY"
  ]);

  function decideFailureAction({
    error,
    stage,
    selected,
    fallbacks,
    budget,
    health,
    alreadyFallback,
    alreadyRepaired,
    alreadyLengthRetry
  }) {
    const code = String(error && (error.code || error.errorCode || error.name) || "PROVIDER_ERROR");
    const remaining = budget && typeof budget.remainingCalls === "function"
      ? budget.remainingCalls({ keepVerifier: false })
      : 0;

    if (NO_CROSS_MODEL.has(code)) {
      return {
        action: "fail",
        reason: code === "AUTH_ERROR" ? "auth_no_failover" : "policy_no_cross_model",
        target: null
      };
    }

    if (code === "SCHEMA_ERROR" && !alreadyRepaired && remaining > 0) {
      return {
        action: "retry_same",
        reason: "schema_repair",
        target: selected
      };
    }

    if (code === "LENGTH_ERROR" && !alreadyLengthRetry && remaining > 0) {
      return {
        action: "retry_same",
        reason: "raise_max_output_tokens",
        target: selected
      };
    }

    if (FAILOVER_ERRORS.has(code) && !alreadyFallback && remaining > 0) {
      const target = pickFallback(fallbacks, selected, health);
      if (target) {
        return { action: "fallback", reason: "failover_" + code.toLowerCase(), target };
      }
    }

    if (code === "SCHEMA_ERROR" || code === "LENGTH_ERROR" || code === "RESPONSE_ERROR") {
      return { action: "degrade", reason: "stage_degrade_" + code.toLowerCase(), target: null };
    }

    return { action: "fail", reason: "unrecoverable_" + code.toLowerCase(), target: null };
  }

  function pickFallback(fallbacks, selected, health) {
    const list = Array.isArray(fallbacks) ? fallbacks : [];
    const healthStore = health && typeof health.get === "function" ? health : null;
    for (const item of list) {
      if (!item) continue;
      const pid = item.providerId || item.provider;
      const sid = selected && (selected.providerId || selected.provider);
      if (selected && pid === sid && item.model === selected.model) continue;
      if (healthStore && typeof healthStore.isRoutable === "function" && !healthStore.isRoutable(pid, item.model, { auto: true })) continue;
      return item;
    }
    return list.find(function (item) {
      if (!item || !selected) return !!item;
      const pid = item.providerId || item.provider;
      const sid = selected.providerId || selected.provider;
      return !(pid === sid && item.model === selected.model);
    }) || null;
  }

  bg.failoverPolicy = {
    FAILOVER_ERRORS,
    NO_CROSS_MODEL,
    decideFailureAction,
    pickFallback
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
