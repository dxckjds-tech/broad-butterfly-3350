import type { EvidenceRecord, IdentityHypothesis } from '@trade-ai/shared-types';
import { IDENTITY_SPEC_NAMES, normalizeText } from '../knowledge/lexicon';
import { identityPhrases, phraseOverlap } from '../knowledge/noun-phrase';

function uniqueHyps(rows: IdentityHypothesis[]): IdentityHypothesis[] {
  const seen = new Set<string>();
  const out: IdentityHypothesis[] = [];
  for (const row of rows) {
    const k = `${row.kind}:${normalizeText(row.label)}`;
    if (!row.label || seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

export function generateHypotheses(evidence: EvidenceRecord[]): IdentityHypothesis[] {
  const title = evidence.find((e) => e.channel === 'TITLE' || e.channel === 'PRODUCT_NAME');
  const category = evidence.find((e) => e.channel === 'CATEGORY');
  const typeSpecs = evidence.filter((e) => e.channel === 'SPEC' && IDENTITY_SPEC_NAMES.test(e.field.replace(/^spec\./, '')));
  const desc = evidence.find((e) => e.channel === 'DESCRIPTION');

  const product: IdentityHypothesis[] = [];
  let i = 0;
  const push = (label: string, kind: 'product' | 'category', prior: number, ev: string[], rationale: string) => {
    i += 1;
    product.push({
      id: `h${i}`,
      label,
      kind,
      prior,
      posterior: prior,
      supportingEvidence: ev,
      opposingEvidence: [],
      rationale,
    });
  };

  if (title) {
    for (const phrase of identityPhrases(title.value)) {
      push(phrase, 'product', phrase.split(' ').length >= 2 ? 0.55 : 0.35, [title.id], 'Extracted from seller title head nouns.');
    }
  }
  for (const spec of typeSpecs) {
    const raw = spec.value.replace(/^[^:]+:\s*/, '');
    for (const phrase of identityPhrases(raw)) {
      push(phrase, 'product', 0.7, [spec.id], 'Extracted from structured Type/Name specification.');
    }
  }
  if (category) {
    for (const phrase of identityPhrases(category.value).concat([category.value])) {
      push(phrase, 'category', 0.45, [category.id], 'Seller-selected category label.');
    }
  }
  if (desc) {
    for (const phrase of identityPhrases(desc.value).slice(0, 2)) {
      push(phrase, 'product', 0.25, [desc.id], 'Weak identity hint from description.');
    }
  }

  const merged = uniqueHyps(product);
  for (const hyp of merged) {
    if (hyp.kind !== 'product' || !title) continue;
    const specBoost = typeSpecs.some((s) => phraseOverlap(hyp.label, s.value) >= 0.34);
    if (specBoost) {
      hyp.prior = Math.min(0.9, hyp.prior + 0.2);
      hyp.posterior = hyp.prior;
      hyp.supportingEvidence = [...new Set([...hyp.supportingEvidence, ...typeSpecs.map((s) => s.id)])];
      hyp.rationale = 'Title head noun agrees with structured specification.';
    }
  }
  return merged.sort((a, b) => b.prior - a.prior).slice(0, 8);
}

export function topCandidates(hyps: IdentityHypothesis[], kind: 'product' | 'category', n = 3): IdentityHypothesis[] {
  return hyps
    .filter((h) => h.kind === kind && !h.rejected)
    .sort((a, b) => {
      if (b.posterior !== a.posterior) return b.posterior - a.posterior;
      const words = b.label.split(' ').length - a.label.split(' ').length;
      if (words) return words;
      return b.label.length - a.label.length;
    })
    .slice(0, n);
}
