import { describe, expect, it } from 'vitest';
import { UPI_VERSION, type IdentityHypothesis, type ReasoningState, type ReasoningStepSummary } from '@trade-ai/shared-types';
import { computeConfidence } from '../engine/confidence';
import { createEvidence } from '../engine/evidence';
import { planNextAction, scoreCandidateActions } from '../engine/planner';
import { buildProductProfile } from '../engine/product-profile';
import { hashToolInput } from '../engine/tools';

function emptyConfidence() {
  return computeConfidence({
    productHyps: [],
    categoryHyps: [],
    conflicts: [],
    unknowns: [],
    verifiedCount: 0,
    observedCount: 0,
    userVerified: false,
  });
}

function hyp(label: string, extra: Partial<IdentityHypothesis> = {}): IdentityHypothesis {
  return {
    id: extra.id ?? `h-${label.replace(/\s+/g, '-')}`,
    label,
    kind: 'product',
    prior: extra.prior ?? extra.posterior ?? 0.5,
    posterior: extra.posterior ?? 0.5,
    supportingEvidence: extra.supportingEvidence ?? [],
    opposingEvidence: extra.opposingEvidence ?? [],
    rationale: extra.rationale ?? 'synthetic',
    ...extra,
  };
}

function checkedSteps(conflictCount = 0): ReasoningStepSummary[] {
  return [
    { index: 1, phase: 'OBSERVE', summary: 'observed', hypothesisCount: 1, conflictCount, action: 'OBSERVE' },
    { index: 2, phase: 'GENERATE_HYPOTHESES', summary: 'hypotheses', hypothesisCount: 1, conflictCount, action: 'HYPOTHESIZE' },
    { index: 3, phase: 'CHECK_EVIDENCE', summary: 'checked', hypothesisCount: 1, conflictCount, action: 'CHECK' },
  ];
}

function baseState(over: Partial<ReasoningState> = {}): ReasoningState {
  const confidence = emptyConfidence();
  const observations = over.observations ?? [];
  const hypotheses = over.hypotheses ?? [];
  const conflicts = over.conflicts ?? [];
  const productProfile = buildProductProfile({
    observations,
    verifiedFacts: over.verifiedFacts ?? [],
    inferences: over.inferences ?? [],
    observedFacts: over.observedFacts ?? [],
    hypotheses,
    conflicts,
    confidence,
  });
  return {
    observations,
    verifiedFacts: over.verifiedFacts ?? [],
    inferences: over.inferences ?? [],
    observedFacts: over.observedFacts ?? [],
    hypotheses,
    rejectedHypotheses: [],
    conflicts,
    unknowns: over.unknowns ?? [],
    nextActions: [],
    confidence,
    status: 'RUNNING',
    productProfile,
    seo: {
      canProceed: false,
      autoApplyAllowed: false,
      officialTop3: [],
      candidateKeywords: [],
      searchDemand: 'NOT_AVAILABLE',
      note: '',
    },
    steps: over.steps ?? [],
    tools: over.tools ?? [],
    version: UPI_VERSION,
    finalized: false,
    ...over,
  };
}

const title = createEvidence('e-title', 'TITLE', 'title', 'Alpha Device');
const spec = createEvidence('e-spec', 'SPEC', 'spec.Type', 'Type: Alpha Device');
const image = createEvidence('e-img', 'IMAGE', 'image', 'https://cdn.example.com/item.jpg');

describe('planner chooses nextAction from state, not a fixed category route', () => {
  it('picks CHALLENGE when identity is in conflict after CHECK', () => {
    const state = baseState({
      observations: [title, spec],
      hypotheses: [
        hyp('alpha device', { posterior: 0.7, supportingEvidence: [title.id] }),
        hyp('beta device', { id: 'h-beta', posterior: 0.68, supportingEvidence: ['e-cat'] }),
      ],
      conflicts: [
        {
          id: 'c-id',
          code: 'IDENTITY_MISMATCH',
          summary: 'Title identity disagrees with the other candidate.',
          left: 'alpha device',
          right: 'beta device',
          evidenceIds: [title.id],
        },
      ],
      steps: checkedSteps(1),
    });
    const next = planNextAction(state, 4);
    expect(next.type).toBe('CHALLENGE');
    expect(next.expectedInformationGain).toBeGreaterThan(0);
    expect(next.reason).toMatch(/conflict/i);
  });

  it('picks CALL_TOOL imageAnalyzer when images are unused and identity is not sufficient', () => {
    const state = baseState({
      observations: [title, image],
      hypotheses: [hyp('alpha device', { posterior: 0.45, supportingEvidence: [title.id] })],
      steps: checkedSteps(),
    });
    const next = planNextAction(state, 4);
    expect(next.type).toBe('CALL_TOOL');
    expect(next.tool).toBe('imageAnalyzer');
    expect(next.expectedInformationGain).toBeGreaterThan(0);
    expect(next.inputKey).toBe(hashToolInput({ imageUrls: [image.value] }));
  });

  it('picks FINALIZE when evidence is sufficient and there is no conflict', () => {
    const state = baseState({
      observations: [title, spec],
      hypotheses: [hyp('alpha device', { posterior: 0.9, supportingEvidence: [spec.id, title.id] })],
      steps: checkedSteps(),
    });
    const next = planNextAction(state, 4);
    expect(next.type).toBe('FINALIZE');
    expect(next.goal).not.toBe('BEST_AVAILABLE');
    expect(next.reason).toMatch(/sufficient/i);
  });

  it('does not repeat CALL_TOOL after the image analyzer is UNAVAILABLE', () => {
    const inputHash = hashToolInput({ imageUrls: [image.value] });
    const state = baseState({
      observations: [title, image],
      hypotheses: [hyp('alpha device', { posterior: 0.45, supportingEvidence: [title.id] })],
      steps: [
        ...checkedSteps(),
        {
          index: 4,
          phase: 'CALL_TOOL',
          summary: 'CALL_TOOL imageAnalyzer → UNAVAILABLE',
          hypothesisCount: 1,
          conflictCount: 0,
          action: 'CALL_TOOL:imageAnalyzer',
        },
      ],
      tools: [
        {
          tool: 'imageAnalyzer',
          status: 'UNAVAILABLE',
          attempts: 1,
          inputHash,
          message: 'UNAVAILABLE',
        },
      ],
    });
    const scored = scoreCandidateActions(state, 5);
    expect(scored.some((c) => c.tool === 'imageAnalyzer' && (c.expectedInformationGain ?? 0) > 0)).toBe(false);
    const next = planNextAction(state, 5);
    expect(next.tool).not.toBe('imageAnalyzer');
    expect(`${next.type}:${next.tool ?? ''}:${next.inputKey ?? ''}`).not.toBe(`CALL_TOOL:imageAnalyzer:${inputHash}`);
  });
});
