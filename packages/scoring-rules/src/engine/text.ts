const MARKETING = [
  'high quality',
  'best quality',
  'best',
  'cheap',
  'hot sale',
  'factory price',
  'competitive price',
  'professional supplier',
  'excellent service',
  'good quality',
  'top quality',
  'premium quality',
  'wholesale',
];

export function englishWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9-]{1,}/g) ?? []).filter((w) => w.length > 1);
}

export function wordCount(text: string): number {
  return englishWords(text).length;
}

export function countOccurrences(haystack: string, phrases: string[]): number {
  const lower = haystack.toLowerCase();
  return phrases.reduce((n, p) => n + (lower.includes(p) ? 1 : 0), 0);
}

export function marketingPhraseHits(text: string): number {
  return countOccurrences(text, MARKETING);
}

export function symbolCount(text: string): number {
  return (text.match(/[/|,;·•]/g) ?? []).length;
}

export const APPLICATION_PATTERNS =
  /\b(application|used for|suitable for|widely used|industry|scenario|for (residential|commercial|industrial|automotive))\b/i;

export const FAQ_PATTERNS = /\b(faq|frequently asked|q:|question:)\b/i;

export const COMPANY_SIGNALS = [
  'factory',
  'manufacturer',
  'years',
  'production line',
  'employees',
  'annual output',
  'export',
  'quality control',
  'r&d',
  'research',
  'certification',
  'iso',
];

export const SECTION_KEYS: Record<string, RegExp> = {
  description: /product description|overview/i,
  specification: /specification|parameter|technical data/i,
  features: /feature|advantage/i,
  applications: /application|used for|suitable for/i,
  customization: /customization|oem|odm|custom/i,
  packaging: /packag/i,
  delivery: /deliver|lead time|shipping/i,
  faq: /faq|frequently asked/i,
  company: /company|factory|manufacturer|about us/i,
  certification: /certif|iso|ce\b/i,
  quality: /quality control|qc\b/i,
};

export function sectionCount(text: string): number {
  return Object.values(SECTION_KEYS).filter((re) => re.test(text)).length;
}

export function meaningfulTextRatio(text: string): number {
  const words = englishWords(text);
  if (!words.length) return 0;
  const fluff = marketingPhraseHits(text);
  const filler = words.filter((w) =>
    ['the', 'and', 'for', 'with', 'our', 'you', 'very', 'more'].includes(w),
  ).length;
  return Math.max(0, 1 - (fluff * 4 + filler) / Math.max(words.length, 1));
}
