export interface ProductFamilyDef {
  id: string;
  core: string;
  family: string;
  type: string;
  aliases: string[];
  mismatches: string[];
}

export const PRODUCT_FAMILY_CATALOG: ProductFamilyDef[] = [
  {
    id: 'wet_dry_vacuum',
    core: 'vacuum cleaner',
    family: 'wet and dry vacuum cleaner',
    type: 'Wet and Dry Vacuum Cleaner',
    aliases: [
      'vacuum cleaner',
      'wet and dry vacuum',
      'wet dry vacuum',
      'wet/dry vacuum',
      'shop vac',
      'industrial vacuum',
      'wet and dry vacuum cleaner',
    ],
    mismatches: ['steam cleaner', 'steam mop', 'steam vacuum', 'carpet cleaner', 'pressure washer'],
  },
  {
    id: 'steam_cleaner',
    core: 'steam cleaner',
    family: 'steam cleaner',
    type: 'Steam Cleaner',
    aliases: ['steam cleaner', 'steam mop', 'steam vacuum'],
    mismatches: ['vacuum cleaner', 'wet and dry vacuum', 'wet dry vacuum', 'wet/dry vacuum', 'shop vac'],
  },
  {
    id: 'pressure_washer',
    core: 'pressure washer',
    family: 'pressure washer',
    type: 'Pressure Washer',
    aliases: ['pressure washer', 'high pressure washer', 'power washer'],
    mismatches: ['vacuum cleaner', 'steam cleaner'],
  },
];

export function normalizeProductText(value: string): string {
  return value
    .toLowerCase()
    .replace(/wet\s*\/\s*dry/g, 'wet dry')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectProductFamily(text: string): ProductFamilyDef | null {
  const n = normalizeProductText(text);
  if (!n) return null;
  let best: { def: ProductFamilyDef; len: number } | null = null;
  for (const def of PRODUCT_FAMILY_CATALOG) {
    for (const alias of def.aliases) {
      const a = normalizeProductText(alias);
      if (a && n.includes(a) && a.length >= (best?.len ?? 0)) {
        best = { def, len: a.length };
      }
    }
  }
  return best?.def ?? null;
}

export function familiesConflict(a: ProductFamilyDef | null, b: ProductFamilyDef | null): boolean {
  if (!a || !b) return false;
  if (a.id === b.id) return false;
  const aHits = a.mismatches.some((m) => b.aliases.some((alias) => normalizeProductText(alias).includes(normalizeProductText(m)) || normalizeProductText(m).includes(normalizeProductText(alias))));
  const bHits = b.mismatches.some((m) => a.aliases.some((alias) => normalizeProductText(alias).includes(normalizeProductText(m)) || normalizeProductText(m).includes(normalizeProductText(alias))));
  return aHits || bHits || a.id !== b.id;
}
