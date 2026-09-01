import type {
  ConfidenceFactors,
  ConfidenceReport,
  IdentityHypothesis,
  ReasoningConflict,
  UnknownRecord,
} from '@trade-ai/shared-types';
import { UPI_CONFIDENCE_FORMULA_VERSION } from '@trade-ai/shared-types';

export function computeConfidence(input: {
  productHyps: IdentityHypothesis[];
  categoryHyps: IdentityHypothesis[];
  conflicts: ReasoningConflict[];
  unknowns: UnknownRecord[];
  verifiedCount: number;
  observedCount: number;
  userVerified: boolean;
}): ConfidenceReport {
  const top = input.productHyps[0];
  const cat = input.categoryHyps[0];
  const titleSpecAgreement = top
    ? Math.min(1, top.supportingEvidence.length / 3)
    : 0;
  const categoryAgreement =
    top && cat ? (top.opposingEvidence.length ? 0 : Math.min(1, 0.4 + titleSpecAgreement * 0.3)) : 0.3;
  const coverageDenom = Math.max(4, input.verifiedCount + input.observedCount);
  const evidenceCoverage = Math.min(1, (input.verifiedCount + input.observedCount * 0.4) / coverageDenom);
  const conflictPenalty = Math.min(1, input.conflicts.length * 0.35);
  const unknownPenalty = Math.min(1, input.unknowns.filter((u) => u.blocking).length * 0.2);
  const sellerInputOnlyPenalty = top && top.supportingEvidence.length <= 1 ? 0.25 : 0;

  const factors: ConfidenceFactors = {
    titleSpecAgreement: round4(titleSpecAgreement),
    categoryAgreement: round4(categoryAgreement),
    evidenceCoverage: round4(evidenceCoverage),
    conflictPenalty: round4(conflictPenalty),
    unknownPenalty: round4(unknownPenalty),
    sellerInputOnlyPenalty: round4(sellerInputOnlyPenalty),
  };

  let score =
    0.2 +
    0.3 * factors.titleSpecAgreement +
    0.15 * factors.categoryAgreement +
    0.25 * factors.evidenceCoverage -
    0.28 * factors.conflictPenalty -
    0.12 * factors.unknownPenalty -
    0.1 * factors.sellerInputOnlyPenalty;
  if (input.userVerified) score = Math.max(score, 0.82);
  score = Math.max(0, Math.min(1, score));
  const spread = 0.08 + 0.1 * factors.conflictPenalty + 0.06 * factors.unknownPenalty;
  return {
    score: round4(score),
    interval: { low: round4(Math.max(0, score - spread)), high: round4(Math.min(1, score + spread)) },
    factors,
    formulaVersion: UPI_CONFIDENCE_FORMULA_VERSION,
    notes: [
      `score=0.2+0.3*titleSpec+0.15*category+0.25*coverage-0.28*conflict-0.12*unknown-0.1*sellerOnly`,
    ],
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
