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

export function phraseOverlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
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
  const ta = tokens(a);
  const tb = tokens(b);
  const shared = ta.filter((t) => tb.includes(t));
  if (!shared.length) return false;
  return shared.every((t) => GENERIC_HEAD_NOUNS.has(t) || STOP_WORDS.has(t));
}

export function distinctModifiers(a: string, b: string): { left: string[]; right: string[] } {
  const ta = tokens(a).filter((t) => !GENERIC_HEAD_NOUNS.has(t));
  const tb = tokens(b).filter((t) => !GENERIC_HEAD_NOUNS.has(t));
  return {
    left: ta.filter((t) => !tb.includes(t)),
    right: tb.filter((t) => !ta.includes(t)),
  };
}
