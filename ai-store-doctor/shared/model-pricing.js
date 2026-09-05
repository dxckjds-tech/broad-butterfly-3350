/**
 * Static USD pricing registry. Unknown / custom = costKnown false.
 * Never invent prices. Router must not hardcode brand cheap/expensive.
 */
(function initModelPricing(global) {
  const ASD = (global.ASD = global.ASD || {});
  const shared = (ASD.shared = ASD.shared || {});

  const PRICING_VERSION = "2026-03-registry-v1";
  const SOURCE_DATE = "2026-03-01";

  const REGISTRY = [
    { provider: "openai", model: "gpt-4o-mini", inputPer1M: 0.15, outputPer1M: 0.6 },
    { provider: "openai", model: "gpt-4o", inputPer1M: 2.5, outputPer1M: 10 },
    { provider: "openai", model: "gpt-4.1-mini", inputPer1M: 0.4, outputPer1M: 1.6 },
    { provider: "openai", model: "gpt-4.1", inputPer1M: 2, outputPer1M: 8 },
    { provider: "deepseek", model: "deepseek-chat", inputPer1M: 0.27, outputPer1M: 1.1 },
    { provider: "deepseek", model: "deepseek-reasoner", inputPer1M: 0.55, outputPer1M: 2.19 },
    { provider: "kimi", model: "moonshot-v1-8k", inputPer1M: 1.2, outputPer1M: 1.2 },
    { provider: "kimi", model: "moonshot-v1-32k", inputPer1M: 2.4, outputPer1M: 2.4 },
    { provider: "kimi", model: "kimi-k2.5", inputPer1M: 0.6, outputPer1M: 2.4 },
    { provider: "gemini", model: "gemini-2.0-flash", inputPer1M: 0.1, outputPer1M: 0.4 },
    { provider: "gemini", model: "gemini-1.5-flash", inputPer1M: 0.075, outputPer1M: 0.3 },
    { provider: "anthropic", model: "claude-3-5-haiku", inputPer1M: 0.8, outputPer1M: 4 },
    { provider: "anthropic", model: "claude-3-5-sonnet", inputPer1M: 3, outputPer1M: 15 }
  ].map((row) => ({
    ...row,
    currency: "USD",
    pricingVersion: PRICING_VERSION,
    sourceDate: SOURCE_DATE
  }));

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function lookup(provider, model) {
    const p = normalizeName(provider);
    const m = normalizeName(model);
    if (!p || !m || p === "custom") return null;
    return (
      REGISTRY.find((row) => row.provider === p && normalizeName(row.model) === m) ||
      REGISTRY.find((row) => row.provider === p && m.startsWith(normalizeName(row.model))) ||
      null
    );
  }

  function estimateCostUsd({ provider, model, inputTokens, outputTokens }) {
    const row = lookup(provider, model);
    if (!row) {
      return {
        estimatedCostUsd: null,
        costKnown: false,
        costEstimated: false,
        pricingVersion: PRICING_VERSION
      };
    }
    const input = Math.max(0, Number(inputTokens) || 0);
    const output = Math.max(0, Number(outputTokens) || 0);
    const usd = (input / 1e6) * row.inputPer1M + (output / 1e6) * row.outputPer1M;
    return {
      estimatedCostUsd: Math.round(usd * 1e6) / 1e6,
      costKnown: true,
      costEstimated: true,
      pricingVersion: row.pricingVersion,
      sourceDate: row.sourceDate
    };
  }

  shared.modelPricing = {
    PRICING_VERSION,
    SOURCE_DATE,
    REGISTRY,
    lookup,
    estimateCostUsd
  };
  ASD.modelPricing = shared.modelPricing;
})(typeof globalThis !== "undefined" ? globalThis : this);
