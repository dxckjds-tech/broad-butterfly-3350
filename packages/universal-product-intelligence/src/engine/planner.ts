import type { ReasoningAction, ReasoningState } from '@trade-ai/shared-types';

export function planNextAction(state: ReasoningState, stepIndex: number): ReasoningAction {
  if (!state.observations.length) {
    return { id: `a${stepIndex}`, type: 'OBSERVE', summary: 'Collect page evidence.', done: false };
  }
  if (!state.hypotheses.length) {
    return { id: `a${stepIndex}`, type: 'HYPOTHESIZE', summary: 'Generate identity and category hypotheses.', done: false };
  }
  if (!state.steps.some((s) => s.phase === 'CHECK_EVIDENCE')) {
    return { id: `a${stepIndex}`, type: 'CHECK', summary: 'Attach supporting and opposing evidence.', done: false };
  }
  if (!state.steps.some((s) => s.phase === 'CHALLENGE')) {
    return { id: `a${stepIndex}`, type: 'CHALLENGE', summary: 'Force challenge of the leading conclusion.', done: false };
  }
  if (!state.steps.some((s) => s.phase === 'REVISE')) {
    return { id: `a${stepIndex}`, type: 'REVISE', summary: 'Revise hypotheses after challenge.', done: false };
  }
  return { id: `a${stepIndex}`, type: 'FINALIZE', summary: 'No further information gain.', done: false };
}
