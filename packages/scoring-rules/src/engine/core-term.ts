import type { PlatformPageData } from '@trade-ai/shared-types';
import { englishWords } from './text';

const STOP = new Set([
  'high',
  'quality',
  'best',
  'cheap',
  'hot',
  'sale',
  'new',
  'factory',
  'wholesale',
  'custom',
  'oem',
  'odm',
  'professional',
  'supplier',
  'manufacturer',
  'made',
  'china',
  'the',
  'and',
  'for',
  'with',
  'from',
]);

const PRODUCT_NOUNS = [
  'vacuum cleaner',
  'wet and dry vacuum',
  'steam cleaner',
  'steam mop',
  'pressure washer',
  'air compressor',
  'window handle',
  'door lock',
  'door handle',
  'hinge',
  'valve',
  'bearing',
  'pump',
  'motor',
  'sensor',
  'machine',
  'equipment',
  'bag',
  'box',
  'bottle',
  'lamp',
  'light',
  'cable',
  'connector',
  'switch',
  'lock',
  'handle',
  'hardware',
  'accessories',
];

export function detectCoreProductTerm(page: PlatformPageData): {
  coreProductTerm: string | null;
  modifiers: string[];
  distinctProductTerms: string[];
} {
  const title = page.productName ?? '';
  const specText = Object.entries(page.specifications ?? {})
    .map(([name, value]) => `${name} ${value}`)
    .join(' ');
  const extra = [page.category, ...(page.keywords ?? []), specText].join(' ').toLowerCase();
  const hay = `${title} ${extra}`.toLowerCase();

  const found = PRODUCT_NOUNS.filter((n) => hay.includes(n));
  const distinct = collapseNested([...new Set(found)]);
  const core = distinct[0] ?? inferFromTitle(title);
  const words = englishWords(title).filter((w) => !STOP.has(w));
  const modifiers = words.filter((w) => core && !core.includes(w));

  return { coreProductTerm: core, modifiers, distinctProductTerms: distinct };
}

function collapseNested(terms: string[]): string[] {
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const kept: string[] = [];
  for (const term of sorted) {
    if (kept.some((item) => item.includes(term))) continue;
    kept.push(term);
  }
  return kept;
}

function inferFromTitle(title: string): string | null {
  const words = englishWords(title).filter((w) => !STOP.has(w));
  if (words.length >= 2) return words.slice(-2).join(' ');
  if (words.length === 1) return words[0] ?? null;
  return null;
}

export function attributeCount(title: string): number {
  const t = title.toLowerCase();
  let n = 0;
  if (/\b(aluminum|steel|plastic|stainless|wood|rubber|copper|brass|iron|alloy|abs|pp|pe|pvc)\b/.test(t)) n += 1;
  if (/\b(for |residential|commercial|industrial|automotive|window|door|kitchen|medical)\b/.test(t)) n += 1;
  if (/\b(casement|sliding|folding|led|hydraulic|electric|manual|automatic|type|model)\b/.test(t)) n += 1;
  if (/\b(waterproof|anti-?theft|heavy.?duty|portable|adjustable)\b/.test(t)) n += 1;
  return n;
}
