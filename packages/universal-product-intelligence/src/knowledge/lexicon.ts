/** Configurable generic lexicon. No concrete product SKUs or catalog identities live here. */

export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'with', 'from', 'in', 'on', 'by', 'at',
  'our', 'your', 'best', 'new', 'hot', 'sale', 'type', 'model', 'item', 'product', 'use',
  'used', 'high', 'low', 'heavy', 'duty', 'quality', 'premium', 'professional', 'supplier',
  'manufacturer', 'factory', 'wholesale', 'custom', 'oem', 'odm', 'made', 'china', 'export',
]);

export const MARKETING_PHRASES = [
  'high quality',
  'best quality',
  'factory price',
  'hot sale',
  'wholesale',
  'welcome to inquiry',
  'competitive price',
  'top quality',
];

export const GENERIC_HEAD_NOUNS = new Set([
  'cleaner',
  'machine',
  'equipment',
  'device',
  'system',
  'kit',
  'set',
  'unit',
  'tool',
  'light',
  'lamp',
  'pump',
  'valve',
  'motor',
  'box',
  'bag',
  'chair',
  'table',
  'vest',
  'pad',
  'profile',
  'part',
  'parts',
  'accessory',
  'accessories',
  'module',
]);

export const PROTECTED_ATTRIBUTES = [
  'eco friendly',
  'environmentally friendly',
  'medical grade',
  'food grade',
  'waterproof',
  'heavy duty',
  'high pressure',
  'high suction',
  'professional',
  'commercial',
  'industrial',
  'portable',
  'cordless',
];

export const APPLICATION_SCENES = [
  'hospital',
  'hotel',
  'sofa',
  'car',
  'automotive',
  'workshop',
  'factory',
  'clinic',
  'kitchen',
  'outdoor',
  'indoor',
  'irrigation',
  'construction',
  'marine',
];

export const MATERIAL_FAMILIES: Record<string, string[]> = {
  metal: ['stainless steel', 'stainless', 'steel', 'aluminum', 'aluminium', 'copper', 'brass', 'iron', 'alloy', 'zinc'],
  plastic: ['plastic', 'abs', 'pp', 'pe', 'pvc', 'nylon', 'pc', 'pet'],
  wood: ['wood', 'wooden', 'solid wood', 'oak', 'pine', 'mdf'],
  textile: ['fabric', 'polyester', 'cotton', 'oxford', 'mesh', 'nylon fabric'],
  glass: ['glass', 'tempered glass'],
  rubber: ['rubber', 'silicone', 'tpe', 'tpu'],
};

export const CERT_RE = /\b(iso\s?\d{3,5}|ce|cb|etl|fda|rohs|ul\s?\d*|sgs|tuv|iec\s?\d+|ccc|reach|gmp|en\s?\d+)\b/gi;

export const TRUSTED_SPEC_NAMES = /^(type|product type|item name|product name|name|function|application|used for|material|power|voltage|size|capacity|suction|pressure|ip rating|color)$/i;

export const IDENTITY_SPEC_NAMES = /^(type|product type|item name|product name|name)$/i;
export const APPLICATION_SPEC_NAMES = /application|used for|scene|industry|suitable/i;
export const MATERIAL_SPEC_NAMES = /material|fabric|finish/i;
export const CERTIFICATION_SPEC_NAMES = /certification|certificate|standard|approval|compliance|certified/i;
export const PERFORMANCE_SPEC_NAMES = /power|voltage|watt|pressure|capacity|suction|flow|speed|current|horsepower/i;

/** Generic performance measures: number + unit. Not product-specific. */
export const PERFORMANCE_MEASURE_RE =
  /\b(\d+(?:\.\d+)?)\s*(k?w|kw|hp|v|volt|a|amp|bar|psi|mpa|kpa|pa|l|liter|rpm|hz|kg|t|m3|gal|gpm)\b/gi;

/** Structured spec tokens that are not certifications. */
export const SPECIFICATION_TOKEN_RE = /\b(ip\s?\d{2}|dn\s?\d+|pn\s?\d+|npt|bsp|ansi|din\s?\d+)\b/gi;

export const COMPATIBILITY_MARKERS = [
  'compatible with',
  'fits',
  'fitment',
  'replacement for',
  'aftermarket',
  'racing',
  'oem fit',
];

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/wet\s*\/\s*dry/g, 'wet dry')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

export function materialFamily(value: string): string | null {
  const n = normalizeText(value);
  for (const [family, words] of Object.entries(MATERIAL_FAMILIES)) {
    if (words.some((w) => n.includes(w))) return family;
  }
  return null;
}
