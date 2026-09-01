import type {
  DynamicAttribute,
  FactRecord,
  FactStatus,
  IdentityHypothesis,
  ReasoningState,
  UniversalProductProfile,
} from '@trade-ai/shared-types';
import { topCandidates } from './hypothesis';

const STATUS_RANK: Record<FactStatus, number> = {
  VERIFIED: 3,
  INFERRED: 2,
  OBSERVED: 1,
  UNKNOWN: 0,
};

function mergeAttributes(rows: DynamicAttribute[]): DynamicAttribute[] {
  const byName = new Map<string, DynamicAttribute>();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing || STATUS_RANK[row.status] > STATUS_RANK[existing.status]) {
      byName.set(key, row);
    }
  }
  return [...byName.values()];
}

function asAttr(f: FactRecord): DynamicAttribute {
  return { name: f.label, value: f.value, status: f.status, evidenceIds: f.evidenceIds };
}

export function buildProductProfile(
  state: Pick<
    ReasoningState,
    'observations' | 'verifiedFacts' | 'inferences' | 'observedFacts' | 'hypotheses' | 'conflicts' | 'confidence'
  >,
): UniversalProductProfile {
  const productHyps = topCandidates(state.hypotheses, 'product', 3);
  const categoryHyps = topCandidates(state.hypotheses, 'category', 3);
  const top = productHyps[0];
  const ofKind = (kind: FactRecord['kind']) =>
    [...state.verifiedFacts, ...state.inferences, ...(state.observedFacts ?? [])].filter((f) => f.kind === kind);

  const dynamicAttributes = mergeAttributes(
    [...state.verifiedFacts, ...state.inferences, ...(state.observedFacts ?? [])]
      .filter((f) => f.kind === 'attribute' && f.label !== 'marketing')
      .map(asAttr),
  );

  const specs: Record<string, string> = {};
  for (const f of state.verifiedFacts.filter((x) => x.kind === 'specification')) {
    specs[f.label] = f.value;
  }

  return {
    identity: {
      label: top?.label || 'unknown product',
      status:
        top && top.posterior >= 0.7 && top.opposingEvidence.length === 0
          ? 'VERIFIED'
          : top
            ? 'INFERRED'
            : 'UNKNOWN',
      candidates: productHyps,
      evidenceIds: top?.supportingEvidence ?? [],
    },
    categoryCandidates: categoryHyps,
    dynamicAttributes,
    functions: ofKind('function').filter((f) => f.status === 'VERIFIED' || f.status === 'INFERRED'),
    applications: ofKind('application').filter((f) => f.status === 'VERIFIED' || f.status === 'INFERRED'),
    materials: ofKind('material').filter((f) => f.status === 'VERIFIED'),
    specifications: specs,
    certifications: ofKind('certification').filter((f) => f.status === 'VERIFIED'),
    components: ofKind('component'),
    visualFacts: ofKind('visual'),
    evidence: state.observations,
    conflicts: state.conflicts,
    confidence: state.confidence,
  };
}

export function leadingProduct(hyps: IdentityHypothesis[]): IdentityHypothesis | undefined {
  return topCandidates(hyps, 'product', 1)[0];
}
