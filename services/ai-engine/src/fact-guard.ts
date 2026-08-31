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
  | 'price'
  | 'ecoFriendly'
  | 'medicalGrade'
  | 'foodGrade'
  | 'waterproof'
  | 'heavyDuty'
  | 'highPressure'
  | 'highSuction'
  | 'professional'
  | 'commercial'
  | 'industrial'
  | 'portable'
  | 'cordless'
  | 'application';

export interface KnownFacts {
  productName?: string;
  companyName?: string;
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
  severe: boolean;
}

const SEVERE_KEYS = new Set<FactClaimKey>([
  'certification',
  'medicalGrade',
  'foodGrade',
  'application',
]);

type ClaimPattern = {
  key: FactClaimKey;
  re: RegExp;
  corpus: 'listing' | 'application';
};

const PATTERNS: ClaimPattern[] = [
  { key: 'certification', re: /\b(ISO\s?\d{3,5}|CE|FDA|RoHS|UL\s?\d*|SGS|T[UÜ]V|IEC\s?\d+|CCC|REACH|GMP)\b/gi, corpus: 'listing' },
  { key: 'moq', re: /\bMOQ[:\s-]?\s*\d+|\bminimum order\b[^.]{0,24}\d+/gi, corpus: 'listing' },
  { key: 'leadTime', re: /\b(lead time|delivery(?: time)?)\s*[:\-]?\s*\d+\s*(days?|weeks?|months?)/gi, corpus: 'listing' },
  { key: 'factorySize', re: /\b\d[\d,]*\s*(m2|m²|sqm|square meters?)\b/gi, corpus: 'listing' },
  { key: 'employeeCount', re: /\b\d[\d,]*\s*(employees?|workers?|staff)\b/gi, corpus: 'listing' },
  { key: 'productionCapacity', re: /\b\d[\d,]*\s*(pcs|units?|sets)\/(day|month|year)\b|\bannual (output|capacity)\b/gi, corpus: 'listing' },
  { key: 'exportCountries', re: /\bexport(?:ed|s)? to\b[^.!]{0,40}/gi, corpus: 'listing' },
  { key: 'patent', re: /\bpatents?\b|\bpatented\b/gi, corpus: 'listing' },
  { key: 'price', re: /(?:USD|US\$|\$|€|RMB|CNY|¥)\s?\d[\d,]*(?:\.\d+)?/gi, corpus: 'listing' },
  { key: 'ecoFriendly', re: /\beco[\s-]?friendly\b|\benvironmentally friendly\b/gi, corpus: 'listing' },
  { key: 'medicalGrade', re: /\bmedical[\s-]?grade\b/gi, corpus: 'listing' },
  { key: 'foodGrade', re: /\bfood[\s-]?grade\b/gi, corpus: 'listing' },
  { key: 'waterproof', re: /\bwaterproof\b/gi, corpus: 'listing' },
  { key: 'heavyDuty', re: /\bheavy[\s-]?duty\b/gi, corpus: 'listing' },
  { key: 'highPressure', re: /\bhigh[\s-]?pressure\b/gi, corpus: 'listing' },
  { key: 'highSuction', re: /\bhigh[\s-]?suction\b/gi, corpus: 'listing' },
  { key: 'professional', re: /\bprofessional\b/gi, corpus: 'listing' },
  { key: 'commercial', re: /\bcommercial\b/gi, corpus: 'listing' },
  { key: 'industrial', re: /\bindustrial\b/gi, corpus: 'listing' },
  { key: 'portable', re: /\bportable\b/gi, corpus: 'listing' },
  { key: 'cordless', re: /\bcordless\b/gi, corpus: 'listing' },
  { key: 'application', re: /\b(cars?|automotive|sofas?|hospitals?|hotels?|workshops?|clinics?)\b/gi, corpus: 'application' },
  { key: 'application', re: /\bfactor(?:y|ies)\b/gi, corpus: 'application' },
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

function isMarketingFactoryHit(text: string, index: number, value: string): boolean {
  const start = Math.max(0, index - 28);
  const end = Math.min(text.length, index + value.length + 28);
  const window = text.slice(start, end).toLowerCase();
  return /factory\s+(price|direct|outlet)|our\s+factory|from\s+(the\s+)?factory/.test(window);
}

export function knownFactsCorpus(facts: KnownFacts): string {
  const spec = Object.entries(facts.specifications ?? {})
    .map(([k, v]) => `${k} ${v}`)
    .join(' ');
  return normalize(
    [
      facts.productName,
      facts.companyName,
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

/** Application evidence only: spec Application / Used for, plus "used for" phrases. Never "factory price". */
export function applicationFactsCorpus(facts: KnownFacts): string {
  const specApps = Object.entries(facts.specifications ?? {})
    .filter(([k]) => /application|used for|scene|industry/i.test(k))
    .map(([k, v]) => `${k} ${v}`);
  const desc = facts.description ?? '';
  const phrases = desc.match(/\b(suitable for|used for|application[s]?[:\s]+)[^.!]{0,80}/gi) ?? [];
  return normalize([...specApps, ...phrases].join(' '));
}

export function applyFactGuard(text: string, facts: KnownFacts): FactGuardResult {
  const listing = knownFactsCorpus(facts);
  const applications = applicationFactsCorpus(facts);
  const removed: FactGuardHit[] = [];
  const warnings: string[] = [];
  let cleaned = text;

  for (const { key, re, corpus } of PATTERNS) {
    const copy = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = copy.exec(text))) {
      const value = m[0].trim();
      const token = normalize(value);
      if (!token) continue;
      if (key === 'application' && /^factor(?:y|ies)$/i.test(token) && isMarketingFactoryHit(text, m.index, value)) {
        continue;
      }
      const allowed = corpus === 'application' ? applications : listing;
      if (!corpusContains(allowed, token)) {
        removed.push({ key, value });
        warnings.push(`FactGuard: unsupported ${key} claim "${value}"`);
        warnings.push(`BLOCKED_BY_FACT_GUARD: ${key} "${value}"`);
        cleaned = cleaned.replace(value, '').replace(/\s{2,}/g, ' ').trim();
      }
    }
  }

  return {
    ok: removed.length === 0,
    cleaned,
    warnings,
    removed,
    severe: removed.some((hit) => SEVERE_KEYS.has(hit.key)),
  };
}

export function applyFactGuardToList(texts: string[], facts: KnownFacts): {
  texts: string[];
  warnings: string[];
  removed: FactGuardHit[];
  severe: boolean;
} {
  const warnings: string[] = [];
  const removed: FactGuardHit[] = [];
  let severe = false;
  const next = texts.map((t) => {
    const r = applyFactGuard(t, facts);
    warnings.push(...r.warnings);
    removed.push(...r.removed);
    if (r.severe) severe = true;
    return r.cleaned;
  });
  return { texts: next, warnings, removed, severe };
}
