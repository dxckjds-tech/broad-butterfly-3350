import type { ReasoningState } from '@trade-ai/shared-types';
import { challengeConclusion } from './conflicts';

export function reflect(state: ReasoningState): ReasoningState {
  const { hyps, notes } = challengeConclusion(state.hypotheses, state.conflicts, state.observations);
  const rejected = hyps.filter((h) => h.rejected);
  return {
    ...state,
    hypotheses: hyps.filter((h) => !h.rejected),
    rejectedHypotheses: [...state.rejectedHypotheses, ...rejected],
    nextActions: state.nextActions.map((a) =>
      a.type === 'CHALLENGE' ? { ...a, done: true, summary: notes.join(' ') } : a,
    ),
    steps: [
      ...state.steps,
      {
        index: state.steps.length + 1,
        phase: 'CHALLENGE',
        summary: notes.join(' ') || 'challengeConclusion',
        hypothesisCount: hyps.filter((h) => !h.rejected).length,
        conflictCount: state.conflicts.length,
      },
    ],
  };
}

/** After challenge: drop weak extra identities; never drop the last product candidate. */
export function revise(state: ReasoningState): ReasoningState {
  const productCount = state.hypotheses.filter((h) => h.kind === 'product').length;
  const next = state.hypotheses.map((h) => {
    if (
      h.kind === 'product' &&
      productCount > 1 &&
      h.opposingEvidence.length > 0 &&
      h.posterior < 0.35
    ) {
      return {
        ...h,
        rejected: true,
        rejectReason: 'Revised after challenge: opposing evidence dominates.',
      };
    }
    return h;
  });
  const kept = next.filter((h) => !h.rejected);
  const rejected = next.filter((h) => Boolean(h.rejected));
  return {
    ...state,
    hypotheses: kept,
    rejectedHypotheses: [...state.rejectedHypotheses, ...rejected],
    nextActions: state.nextActions.map((a) => (a.type === 'REVISE' ? { ...a, done: true } : a)),
    steps: [
      ...state.steps,
      {
        index: state.steps.length + 1,
        phase: 'REVISE',
        summary: rejected.length
          ? `Rejected ${rejected.length} weak hypotheses; kept best-available candidates.`
          : 'No hypotheses rejected; kept top candidates.',
        hypothesisCount: kept.length,
        conflictCount: state.conflicts.length,
      },
    ],
  };
}
