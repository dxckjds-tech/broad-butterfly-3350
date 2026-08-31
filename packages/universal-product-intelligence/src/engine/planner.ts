import type { ReasoningAction, ReasoningState } from '@trade-ai/shared-types';
import { identityClash } from './conflicts';
import { channelsOf } from './evidence';
import { byPosteriorThenSpecificity } from './hypothesis';
import { GENERIC_HEAD_NOUNS, normalizeText } from '../knowledge/lexicon';
import { hashToolInput } from './tools';

export const MAX_REASONING_STEPS = 5;

export function actionKey(action: Pick<ReasoningAction, 'type' | 'tool' | 'inputKey'>): string {
  return `${action.type}:${action.tool ?? ''}:${action.inputKey ?? ''}`;
}

function headNoun(label: string): string {
  const words = normalizeText(label).split(' ').filter(Boolean);
  return words[words.length - 1] ?? '';
}

/** Posterior first, then head-noun specificity so leftover modifier n-grams are not the leader. */
function productHyps(state: ReasoningState) {
  return state.hypotheses.filter((h) => h.kind === 'product' && !h.rejected).sort(byPosteriorThenSpecificity);
}

/** Identity set used for sufficiency and rivals: phrases that end on a generic head noun. */
function headedProductHyps(state: ReasoningState) {
  const all = productHyps(state);
  const headed = all.filter((h) => GENERIC_HEAD_NOUNS.has(headNoun(h.label)));
  return headed.length ? headed : all;
}

function hasDistinctRival(state: ReasoningState): boolean {
  const ps = headedProductHyps(state);
  const top = ps[0];
  if (!top) return false;
  return ps.slice(1).some((p) => identityClash(top.label, p.label));
}

function hypSpread(state: ReasoningState): number {
  const ps = headedProductHyps(state);
  if (ps.length < 2) return 1;
  return (ps[0]?.posterior ?? 0) - (ps[1]?.posterior ?? 0);
}

function toolUnavailable(state: ReasoningState, tool: NonNullable<ReasoningAction['tool']>): boolean {
  return state.tools.some(
    (t) => t.tool === tool && (t.status === 'UNAVAILABLE' || t.status === 'ERROR' || t.status === 'TIMEOUT' || t.status === 'SKIPPED'),
  );
}

function toolTried(state: ReasoningState, tool: NonNullable<ReasoningAction['tool']>, inputKey?: string): boolean {
  if (toolUnavailable(state, tool)) return true;
  return state.tools.some((t) => t.tool === tool && (!inputKey || t.inputHash === inputKey));
}

function imageUrls(state: ReasoningState): string[] {
  return state.observations.filter((e) => e.channel === 'IMAGE').map((e) => e.value).filter(Boolean);
}

/**
 * Order: CHECK must have run → identity/material conflict blocks sufficiency →
 * headed leader must be spec-backed, high posterior, unrivaled.
 */
export function conclusionSufficient(state: ReasoningState): boolean {
  if (!state.steps.some((s) => s.phase === 'CHECK_EVIDENCE')) return false;
  if (state.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH' || c.code === 'MATERIAL_CONFLICT')) return false;
  const top = headedProductHyps(state)[0];
  if (!top || top.opposingEvidence.length) return false;
  if (hasDistinctRival(state) && hypSpread(state) < 0.12) return false;
  const specSupport = channelsOf(state.observations, top.supportingEvidence).includes('SPEC');
  return specSupport && top.posterior >= 0.8;
}

function executedKeys(state: ReasoningState): Set<string> {
  const keys = new Set<string>();
  if (state.observations.length) keys.add('OBSERVE::page');
  if (state.hypotheses.length) keys.add('HYPOTHESIZE::page');
  if (state.steps.some((s) => s.phase === 'CHECK_EVIDENCE')) keys.add('CHECK::page');
  if (state.steps.some((s) => s.phase === 'CHALLENGE')) keys.add('CHALLENGE::page');
  if (state.steps.some((s) => s.phase === 'REVISE')) keys.add('REVISE::page');
  if (state.steps.some((s) => s.phase === 'FINALIZE')) keys.add('FINALIZE::done');
  for (const t of state.tools) {
    keys.add(`CALL_TOOL:${t.tool}:${t.inputHash}`);
    if (t.status === 'UNAVAILABLE' || t.status === 'ERROR' || t.status === 'TIMEOUT' || t.status === 'SKIPPED') {
      keys.add(`CALL_TOOL:${t.tool}:*`);
    }
  }
  return keys;
}

function makeAction(
  stepIndex: number,
  partial: Omit<ReasoningAction, 'id' | 'done'> & { expectedInformationGain: number },
): ReasoningAction {
  return {
    id: `a${stepIndex}`,
    done: false,
    ...partial,
  };
}

/** Score candidate actions from current state. Highest expectedInformationGain wins. */
export function scoreCandidateActions(state: ReasoningState, stepIndex: number): ReasoningAction[] {
  const keys = executedKeys(state);
  const images = imageUrls(state);
  const imageKey = hashToolInput({ imageUrls: images });
  const phrases = state.hypotheses.slice(0, 3).map((h) => h.label);
  const searchKey = hashToolInput({ phrases });
  const blockingUnknowns = state.unknowns.filter((u) => u.blocking);
  const identityConflict = state.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH' || c.code === 'MATERIAL_CONFLICT');
  const sufficient = conclusionSufficient(state);
  const spread = hypSpread(state);
  const rival = hasDistinctRival(state);

  const candidates: ReasoningAction[] = [];

  const observeGain = state.observations.length ? 0 : 1;
  candidates.push(
    makeAction(stepIndex, {
      type: 'OBSERVE',
      inputKey: 'page',
      goal: 'Collect listing evidence',
      reason: state.observations.length ? 'Page already observed.' : 'No observations yet.',
      expectedInformationGain: observeGain,
      summary: 'Collect page evidence.',
    }),
  );

  const hypoGain = !state.observations.length ? 0 : state.hypotheses.length ? 0 : 0.92;
  candidates.push(
    makeAction(stepIndex, {
      type: 'HYPOTHESIZE',
      inputKey: 'page',
      goal: 'Generate identity hypotheses',
      reason: state.hypotheses.length ? 'Hypotheses already generated.' : 'Need product/category candidates.',
      expectedInformationGain: hypoGain,
      summary: 'Generate identity and category hypotheses.',
    }),
  );

  const checked = state.steps.some((s) => s.phase === 'CHECK_EVIDENCE');
  const checkGain = !state.hypotheses.length || checked ? 0 : 0.88;
  candidates.push(
    makeAction(stepIndex, {
      type: 'CHECK',
      inputKey: 'page',
      goal: 'Attach supporting and opposing evidence',
      reason: checked ? 'Evidence already checked.' : 'Hypotheses need supporting/opposing evidence.',
      expectedInformationGain: checkGain,
      summary: 'Attach supporting and opposing evidence.',
    }),
  );

  const challenged = state.steps.some((s) => s.phase === 'CHALLENGE');
  let challengeGain = 0;
  let challengeReason = 'No challenge needed.';
  if (checked && !challenged) {
    if (identityConflict) {
      challengeGain = 0.86;
      challengeReason = 'Identity or material conflict requires challenge.';
    } else if (sufficient) {
      challengeGain = 0;
      challengeReason = 'Conclusion already sufficient; skip challenge.';
    } else if (rival && spread < 0.12) {
      challengeGain = 0.78;
      challengeReason = 'Top hypotheses are too close; challenge confirmation bias.';
    } else if (headedProductHyps(state)[0]?.opposingEvidence.length) {
      challengeGain = 0.72;
      challengeReason = 'Leading hypothesis has opposing evidence.';
    } else {
      challengeGain = 0.42;
      challengeReason = 'Seller-input identity is not yet challenged.';
    }
  }
  candidates.push(
    makeAction(stepIndex, {
      type: 'CHALLENGE',
      inputKey: 'page',
      goal: 'challengeConclusion',
      reason: challengeReason,
      expectedInformationGain: challengeGain,
      summary: 'Challenge the leading conclusion.',
    }),
  );

  const revised = state.steps.some((s) => s.phase === 'REVISE');
  let reviseGain = 0;
  let reviseReason = 'Revise not applicable.';
  if (challenged && !revised) {
    if (identityConflict || headedProductHyps(state).some((h) => h.opposingEvidence.length && h.posterior < 0.6)) {
      reviseGain = 0.7;
      reviseReason = 'Challenge found opposition; revise candidates.';
    } else {
      reviseGain = 0.28;
      reviseReason = 'Keep a revision pass after challenge.';
    }
  }
  candidates.push(
    makeAction(stepIndex, {
      type: 'REVISE',
      inputKey: 'page',
      goal: 'Drop weak extra identities',
      reason: reviseReason,
      expectedInformationGain: reviseGain,
      summary: 'Revise hypotheses after challenge.',
    }),
  );

  let imageGain = 0;
  let imageReason = 'Image analyzer not useful.';
  if (!toolTried(state, 'imageAnalyzer', imageKey) && !keys.has('CALL_TOOL:imageAnalyzer:*')) {
    if (!images.length) {
      imageGain = 0;
      imageReason = 'No images on the page.';
    } else if (sufficient) {
      imageGain = 0.18;
      imageReason = 'Images unused, but identity is already sufficient.';
    } else if (identityConflict || rival || blockingUnknowns.some((u) => u.slot === 'images')) {
      imageGain = 0.64;
      imageReason = 'Images may resolve identity/visual unknowns.';
    } else {
      imageGain = 0.48;
      imageReason = 'Identity not yet sufficient; unused images remain.';
    }
  } else {
    imageReason = 'Image analyzer already tried or UNAVAILABLE.';
  }
  candidates.push(
    makeAction(stepIndex, {
      type: 'CALL_TOOL',
      tool: 'imageAnalyzer',
      inputKey: imageKey,
      goal: 'Visual facts',
      reason: imageReason,
      expectedInformationGain: imageGain,
      summary: 'Attempt image analyzer.',
    }),
  );

  let searchGain = 0;
  let searchReason = 'Search provider not useful.';
  if (!toolTried(state, 'searchDataProvider', searchKey) && !keys.has('CALL_TOOL:searchDataProvider:*')) {
    if (sufficient) {
      searchGain = 0.12;
      searchReason = 'Search would only rank keywords; identity already sufficient.';
    } else if (!checked) {
      searchGain = 0;
      searchReason = 'Need page evidence before search.';
    } else {
      searchGain = 0.22;
      searchReason = 'Search demand unknown; a first probe may fail-soft.';
    }
  } else {
    searchReason = 'Search provider already tried or UNAVAILABLE.';
  }
  candidates.push(
    makeAction(stepIndex, {
      type: 'CALL_TOOL',
      tool: 'searchDataProvider',
      inputKey: searchKey,
      goal: 'Verified search demand',
      reason: searchReason,
      expectedInformationGain: searchGain,
      summary: 'Attempt search data provider.',
    }),
  );

  let finalizeGain = 0;
  let finalizeReason = 'Continue gathering information.';
  const finalizeGoal = 'EARLY_STOP';
  if (sufficient && checked) {
    finalizeGain = 0.55;
    finalizeReason = 'Conclusion sufficient; no further expected gain.';
  } else if (
    checked &&
    !identityConflict &&
    imageGain <= 0 &&
    searchGain <= 0 &&
    challengeGain <= 0 &&
    reviseGain <= 0 &&
    hypoGain <= 0 &&
    checkGain <= 0
  ) {
    finalizeGain = 0.5;
    finalizeReason = 'No remaining action with information gain.';
  }
  candidates.push(
    makeAction(stepIndex, {
      type: 'FINALIZE',
      inputKey: 'done',
      goal: finalizeGoal,
      reason: finalizeReason,
      expectedInformationGain: finalizeGain,
      summary: finalizeReason,
    }),
  );

  return candidates.filter((c) => !keys.has(actionKey(c)) && !keys.has(`${c.type}:${c.tool ?? ''}:*`));
}

export function planNextAction(state: ReasoningState, stepIndex: number): ReasoningAction {
  const scored = scoreCandidateActions(state, stepIndex)
    .filter((c) => (c.expectedInformationGain ?? 0) > 0)
    .sort((a, b) => (b.expectedInformationGain ?? 0) - (a.expectedInformationGain ?? 0));

  if (scored[0]) return scored[0];

  return makeAction(stepIndex, {
    type: 'FINALIZE',
    inputKey: 'done',
    goal: 'EARLY_STOP',
    reason: 'No remaining action with information gain.',
    expectedInformationGain: 0,
    summary: 'No remaining action with information gain.',
  });
}
