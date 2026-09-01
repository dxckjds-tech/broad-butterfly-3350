import { GENERIC_HEAD_NOUNS, STOP_WORDS, normalizeText, tokens } from './lexicon';

/** Generic English head-noun extraction. No catalog of specific products. */
export function splitPurpose(text: string): { product: string; purpose: string } {
  const n = text.replace(/\s+/g, ' ').trim();
  const m = n.match(/^(.*?)\s+for\s+(.+)$/i);
  if (m?.[1] && m[2]) return { product: m[1], purpose: m[2] };
  return { product: n, purpose: '' };
}

export function ngrams(words: string[], size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + size <= words.length; i += 1) {
    out.push(words.slice(i, i + size).join(' '));
  }
  return out;
}

export function identityPhrases(text: string): string[] {
  const { product } = splitPurpose(text);
  const words = tokens(product).filter((w) => !/^\d+$/.test(w));
  if (!words.length) return [];
  const tail = words.slice(-4);
  const phrases = [
    ...ngrams(tail, 3),
    ...ngrams(tail, 2),
    tail.slice(-1).join(' '),
  ].filter((p) => p.split(' ').every((w) => w.length > 1));
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const p of phrases) {
    const k = normalizeText(p);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    uniq.push(p);
  }
  const multi = uniq.filter((p) => p.split(' ').length >= 2);
  return (multi.length ? multi : uniq).slice(0, 6);
}

/** Simple English plurals so a category head like "pumps" matches "pump". */
export function singularize(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (/(?:ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
  return w;
}

export function stemmedTokens(value: string): string[] {
  return tokens(value).map(singularize);
}

/**
 * Parent categories and plural heads are compatible with a more specific product phrase.
 * Distinct heads, or the same head with disjoint specific modifiers, are not.
 */
export function identitiesCompatible(a: string, b: string): boolean {
  const sa = stemmedTokens(a);
  const sb = stemmedTokens(b);
  if (!sa.length || !sb.length) return true;
  const ja = sa.join(' ');
  const jb = sb.join(' ');
  if (ja === jb || ja.includes(jb) || jb.includes(ja)) return true;
  const setA = new Set(sa);
  const setB = new Set(sb);
  if (sa.every((t) => setB.has(t)) || sb.every((t) => setA.has(t))) return true;
  const ha = sa[sa.length - 1] ?? '';
  const hb = sb[sb.length - 1] ?? '';
  if (ha !== hb) return false;
  const modsA = sa.filter((t) => t !== ha && !GENERIC_HEAD_NOUNS.has(t) && !STOP_WORDS.has(t));
  const modsB = sb.filter((t) => t !== hb && !GENERIC_HEAD_NOUNS.has(t) && !STOP_WORDS.has(t));
  if (!modsA.length || !modsB.length) return true;
  return modsA.some((m) => modsB.includes(m));
}

export function phraseOverlap(a: string, b: string): number {
  const ta = new Set(stemmedTokens(a));
  const tb = new Set(stemmedTokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / new Set([...ta, ...tb]).size;
}

export function containsPhrase(hay: string, phrase: string): boolean {
  const h = normalizeText(hay);
  const p = normalizeText(phrase);
  if (!p) return false;
  if (p.length <= 3) return new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(h);
  return h.includes(p);
}

export function sharedOnlyGenericNoun(a: string, b: string): boolean {
  const ta = stemmedTokens(a);
  const tb = stemmedTokens(b);
  const shared = ta.filter((t) => tb.includes(t));
  if (!shared.length) return false;
  return shared.every((t) => GENERIC_HEAD_NOUNS.has(t) || STOP_WORDS.has(t));
}

export function distinctModifiers(a: string, b: string): { left: string[]; right: string[] } {
  const ta = stemmedTokens(a).filter((t) => !GENERIC_HEAD_NOUNS.has(t));
  const tb = stemmedTokens(b).filter((t) => !GENERIC_HEAD_NOUNS.has(t));
  return {
    left: ta.filter((t) => !tb.includes(t)),
    right: tb.filter((t) => !ta.includes(t)),
  };
}
