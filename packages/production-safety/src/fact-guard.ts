const FACT_KEYS = [
  'certification',
  'material',
  'moq',
  'leadTime',
  'factorySize',
  'employeeCount',
  'productionCapacity',
  'brand',
] as const;

export type FactKey = (typeof FACT_KEYS)[number];

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function scanInventedFacts(generated: string, knownFacts: Partial<Record<FactKey, string[]>>): {
  ok: boolean;
  code?: 'FACT_GUARD_FAIL';
  invented: Array<{ key: FactKey; value: string }>;
} {
  const invented: Array<{ key: FactKey; value: string }> = [];
  const text = normalize(generated);
  for (const key of FACT_KEYS) {
    const allowed = (knownFacts[key] ?? []).map(normalize).filter(Boolean);
    if (!allowed.length) continue;
    for (const token of allowed) {
      /* known tokens are allowed */
    }
    const patterns: Record<FactKey, RegExp[]> = {
      certification: [/\biso\s?\d+\b/gi, /\bce\b/gi, /\bfda\b/gi, /\brohs\b/gi],
      material: [],
      moq: [/\bmoq[:\s]+\d+/gi, /最小起订[:\s]+\d+/gi],
      leadTime: [/\blead\s*time[:\s]+\d+/gi, /交期[:\s]+\d+/gi],
      factorySize: [/\d+\s*m[²2]/gi, /\d+\s*平方米/gi],
      employeeCount: [/\d+\s*(employees|人)/gi],
      productionCapacity: [/\d+\s*(pcs|sets)\/?(day|month)/gi],
      brand: [],
    };
    for (const re of patterns[key]) {
      const copy = new RegExp(re.source, re.flags);
      let m: RegExpExecArray | null;
      while ((m = copy.exec(text))) {
        const value = m[0];
        const ok = allowed.some((a) => normalize(value).includes(a) || a.includes(normalize(value)));
        if (!ok && allowed.length) invented.push({ key, value });
      }
    }
  }
  if (invented.length) return { ok: false, code: 'FACT_GUARD_FAIL', invented };
  return { ok: true, invented: [] };
}

export { FACT_KEYS };
