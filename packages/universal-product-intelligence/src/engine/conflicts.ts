import type { EvidenceRecord, IdentityHypothesis, ReasoningConflict } from '@trade-ai/shared-types';
import { APPLICATION_SCENES, CERT_RE, MATERIAL_SPEC_NAMES, PROTECTED_ATTRIBUTES, materialFamily, normalizeText } from '../knowledge/lexicon';
import { containsPhrase, distinctModifiers, phraseOverlap, sharedOnlyGenericNoun } from '../knowledge/noun-phrase';
import { canVerifyProtectedClaim, channelsOf } from './evidence';

export function checkHypothesisEvidence(hyps: IdentityHypothesis[], evidence: EvidenceRecord[]): IdentityHypothesis[] {
  return hyps.map((hyp) => {
    const supporting: string[] = [...hyp.supportingEvidence];
    const opposing: string[] = [...hyp.opposingEvidence];
    for (const ev of evidence) {
      if (ev.channel === 'KEYWORDS') continue;
      const hit = containsPhrase(ev.value, hyp.label) || phraseOverlap(hyp.label, ev.value) >= 0.5;
      if (!hit) continue;
      if (ev.channel === 'CATEGORY' && hyp.kind === 'product') {
        const clash = identityClash(hyp.label, ev.value);
        if (clash) opposing.push(ev.id);
        else supporting.push(ev.id);
      } else {
        supporting.push(ev.id);
      }
    }
    const support = new Set(supporting);
    const oppose = new Set(opposing);
    const posterior = Math.max(
      0.05,
      Math.min(0.95, hyp.prior + 0.08 * support.size - 0.14 * oppose.size),
    );
    return {
      ...hyp,
      supportingEvidence: [...support],
      opposingEvidence: [...oppose],
      posterior,
    };
  });
}

export function identityClash(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return false;
  if (phraseOverlap(a, b) >= 0.5) return false;
  const { left, right } = distinctModifiers(a, b);
  if (sharedOnlyGenericNoun(a, b) && left.length && right.length) return true;
  return phraseOverlap(a, b) < 0.22 && left.length > 0 && right.length > 0;
}

export function detectConflicts(
  hyps: IdentityHypothesis[],
  evidence: EvidenceRecord[],
): ReasoningConflict[] {
  const conflicts: ReasoningConflict[] = [];
  const products = hyps.filter((h) => h.kind === 'product' && !h.rejected);
  const categories = hyps.filter((h) => h.kind === 'category' && !h.rejected);
  const topProduct = products.sort((a, b) => b.posterior - a.posterior)[0];
  const topCategory = categories.sort((a, b) => b.posterior - a.posterior)[0];
  if (topProduct && topCategory && identityClash(topProduct.label, topCategory.label)) {
    conflicts.push({
      id: 'c-identity',
      code: 'IDENTITY_MISMATCH',
      summary: `Title/spec identity "${topProduct.label}" disagrees with category "${topCategory.label}".`,
      left: topProduct.label,
      right: topCategory.label,
      evidenceIds: [...topProduct.supportingEvidence, ...topCategory.supportingEvidence],
    });
  }

  const materialEv = evidence.filter((e) => MATERIAL_SPEC_NAMES.test(e.field.replace(/^spec\./, '')) || /material/i.test(e.field));
  const title = evidence.find((e) => e.channel === 'TITLE' || e.channel === 'PRODUCT_NAME');
  if (title && materialEv.length) {
    const titleFam = materialFamily(title.value);
    for (const spec of materialEv) {
      const specFam = materialFamily(spec.value);
      if (titleFam && specFam && titleFam !== specFam) {
        conflicts.push({
          id: `c-mat-${spec.id}`,
          code: 'MATERIAL_CONFLICT',
          summary: `Title material family "${titleFam}" conflicts with specification "${specFam}".`,
          left: titleFam,
          right: specFam,
          evidenceIds: [title.id, spec.id],
        });
      }
    }
  }

  for (const ev of evidence.filter((e) => e.channel === 'KEYWORDS')) {
    const n = normalizeText(ev.value);
    for (const attr of PROTECTED_ATTRIBUTES) {
      if (!n.includes(attr)) continue;
      const other = evidence.filter((e) => e.channel !== 'KEYWORDS' && containsPhrase(e.value, attr));
      if (!canVerifyProtectedClaim(other.map((e) => e.channel))) {
        conflicts.push({
          id: `c-claim-${ev.id}-${attr.replace(/\s+/g, '-')}`,
          code: 'UNSUPPORTED_CLAIM',
          summary: `Keyword "${ev.value}" asserts "${attr}" without structured evidence.`,
          left: ev.value,
          right: attr,
          evidenceIds: [ev.id],
        });
      }
    }
    if (CERT_RE.test(ev.value)) {
      CERT_RE.lastIndex = 0;
      const certField = evidence.some((e) => e.channel === 'CERTIFICATION_FIELD' || (e.channel === 'SPEC' && /cert/i.test(e.field)));
      if (!certField) {
        conflicts.push({
          id: `c-cert-${ev.id}`,
          code: 'UNSUPPORTED_CLAIM',
          summary: `Keyword "${ev.value}" asserts a certification without a certification field.`,
          left: ev.value,
          right: 'certification',
          evidenceIds: [ev.id],
        });
      }
    }
    for (const scene of APPLICATION_SCENES) {
      if (!containsPhrase(ev.value, scene)) continue;
      const trusted = evidence.some(
        (e) =>
          (e.channel === 'SPEC' && /application|used for|scene/i.test(e.field) && containsPhrase(e.value, scene)) ||
          (e.channel === 'DESCRIPTION' && containsPhrase(e.value, scene) && /used for|suitable for|application/i.test(e.value)),
      );
      if (!trusted) {
        conflicts.push({
          id: `c-app-${ev.id}-${scene}`,
          code: 'UNSUPPORTED_CLAIM',
          summary: `Keyword "${ev.value}" asserts application "${scene}" without a trusted application field.`,
          left: ev.value,
          right: scene,
          evidenceIds: [ev.id],
        });
      }
    }
  }

  const seen = new Set<string>();
  return conflicts.filter((c) => {
    const k = `${c.code}:${c.left}:${c.right}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function challengeConclusion(
  hyps: IdentityHypothesis[],
  conflicts: ReasoningConflict[],
  evidence: EvidenceRecord[],
): { hyps: IdentityHypothesis[]; notes: string[] } {
  const notes: string[] = [];
  const top = [...hyps].filter((h) => h.kind === 'product' && !h.rejected).sort((a, b) => b.posterior - a.posterior)[0];
  if (!top) return { hyps, notes: ['No product hypothesis to challenge.'] };

  const opposition = top.opposingEvidence.length + conflicts.filter((c) => c.code === 'IDENTITY_MISMATCH').length;
  if (opposition > 0) {
    notes.push('Counter-evidence found; first identity is not unique.');
    const next = hyps.map((h) =>
      h.id === top.id
        ? { ...h, posterior: Math.min(h.posterior, 0.58), rationale: `${h.rationale} Challenged by opposing evidence.` }
        : h,
    );
    return { hyps: next, notes };
  }

  const sellerOnly = channelsOf(evidence, top.supportingEvidence).every(
    (c) => c === 'TITLE' || c === 'PRODUCT_NAME' || c === 'KEYWORDS' || c === 'CATEGORY',
  );
  if (sellerOnly) {
    notes.push('Identity currently rests on seller input only; not confirmed.');
    return {
      hyps: hyps.map((h) => (h.id === top.id ? { ...h, posterior: Math.min(h.posterior, 0.62) } : h)),
      notes,
    };
  }
  notes.push('Challenge passed: structured evidence supports the leading identity.');
  return { hyps, notes };
}
