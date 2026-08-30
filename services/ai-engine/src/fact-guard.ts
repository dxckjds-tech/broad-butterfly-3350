export type FactClaimKey =
  | 'certification'
  | 'material'
  | 'moq'
  | 'leadTime'
  | 'factorySize'
  | 'employeeCount'
  | 'productionCapacity'
  | 'exportCountries'
  | 'brand'
  | 'patent'
  | 'price';

export interface KnownFacts {
  productName?: string;
  category?: string;
  keywords?: string[];
  centerTerms?: string[];
  specifications?: Record<string, string>;
  description?: string;
  certifications?: string[];
  moq?: string;
  deliveryTime?: string;
}

export interface FactGuardHit {
  key: FactClaimKey;
  value: string;
}

export interface FactGuardResult {
  ok: boolean;
  cleaned: string;
  warnings: string[];
  removed: FactGuardHit[];
}

const PATTERNS: Array<{ key: FactClaimKey; re: RegExp }> = [
  { key: 'certification', re: /\b(ISO\s?\d{3,5}|CE|FDA|RoHS|UL\s?\d*|SGS|T[UÜ]V|IEC\s?\d+|CCC|REACH|GMP)\b/gi },
  { key: 'moq', re: /\bMOQ[:\s-]?\s*\d+|\bminimum order\b[^.]{0,24}\d+/gi },
  { key: 'leadTime', re: /\b(lead time|delivery(?: time)?)\s*[:\-]?\s*\d+\s*(days?|weeks?|months?)/gi },
  { key: 'factorySize', re: /\b\d[\d,]*\s*(m2|m²|sqm|square meters?)\b/gi },
  { key: 'employeeCount', re: /\b\d[\d,]*\s*(employees?|workers?|staff)\b/gi },
  { key: 'productionCapacity', re: /\b\d[\d,]*\s*(pcs|units?|sets)\/(day|month|year)\b|\bannual (output|capacity)\b/gi },
  { key: 'exportCountries', re: /\bexport(?:ed|s)? to\b[^.!]{0,40}/gi },
  { key: 'patent', re: /\bpatents?\b|\bpatented\b/gi },
  { key: 'price', re: /(?:USD|US\$|\$|€|RMB|CNY|¥)\s?\d[\d,]*(?:\.\d+)?/gi },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function corpusContains(allowed: string, token: string): boolean {
  const t = normalize(token);
  if (!t) return true;
  if (t.length <= 3) {
    return new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i').test(allowed);
  }
  return allowed.includes(t);
}

export function knownFactsCorpus(facts: KnownFacts): string {
  const spec = Object.entries(facts.specifications ?? {})
    .map(([k, v]) => `${k} ${v}`)
    .join(' ');
  return normalize(
    [
      facts.productName,
      facts.category,
      ...(facts.keywords ?? []),
      ...(facts.centerTerms ?? []),
      spec,
      facts.description,
      ...(facts.certifications ?? []),
      facts.moq,
      facts.deliveryTime,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

export function applyFactGuard(text: string, facts: KnownFacts): FactGuardResult {
  const allowed = knownFactsCorpus(facts);
  const removed: FactGuardHit[] = [];
  const warnings: string[] = [];
  let cleaned = text;

  for (const { key, re } of PATTERNS) {
    const copy = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = copy.exec(text))) {
      const value = m[0].trim();
      const token = normalize(value);
      if (!token) continue;
      if (!corpusContains(allowed, token)) {
        removed.push({ key, value });
        warnings.push(`FactGuard: unsupported ${key} claim "${value}"`);
        cleaned = cleaned.replace(value, '').replace(/\s{2,}/g, ' ').trim();
      }
    }
  }

  return { ok: removed.length === 0, cleaned, warnings, removed };
}

export function applyFactGuardToList(texts: string[], facts: KnownFacts): {
  texts: string[];
  warnings: string[];
  removed: FactGuardHit[];
} {
  const warnings: string[] = [];
  const removed: FactGuardHit[] = [];
  const next = texts.map((t) => {
    const r = applyFactGuard(t, facts);
    warnings.push(...r.warnings);
    removed.push(...r.removed);
    return r.cleaned;
  });
  return { texts: next, warnings, removed };
}
