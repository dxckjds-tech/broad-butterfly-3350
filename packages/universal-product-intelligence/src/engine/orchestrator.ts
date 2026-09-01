import type { PlatformPageData, ReasoningState, ReasoningStatus, ReasoningStepSummary } from '@trade-ai/shared-types';
import { UPI_VERSION } from '@trade-ai/shared-types';
import { computeConfidence } from './confidence';
import { checkHypothesisEvidence, detectConflicts } from './conflicts';
import { generateHypotheses, topCandidates } from './hypothesis';
import { observePage } from './observe';
import { MAX_REASONING_STEPS, planNextAction } from './planner';
import { buildProductProfile } from './product-profile';
import { reflect, revise } from './reflector';
import { collectUnknowns, extractFacts } from './state';
import { imageAnalyzer, searchDataProvider } from './tools';
import { planKeywords } from '../seo/keyword-intelligence';

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

function emptyState(): ReasoningState {
  const confidence = emptyConfidence();
  return {
    observations: [],
    verifiedFacts: [],
    inferences: [],
    observedFacts: [],
    hypotheses: [],
    rejectedHypotheses: [],
    conflicts: [],
    unknowns: [],
    nextActions: [],
    confidence,
    status: 'RUNNING',
    productProfile: buildProductProfile({
      observations: [],
      verifiedFacts: [],
      inferences: [],
      observedFacts: [],
      hypotheses: [],
      conflicts: [],
      confidence,
    }),
    seo: {
      canProceed: false,
      autoApplyAllowed: false,
      officialTop3: [],
      candidateKeywords: [],
      searchDemand: 'NOT_AVAILABLE',
      note: '',
    },
    steps: [],
    tools: [],
    version: UPI_VERSION,
    finalized: false,
  };
}

function statusFrom(state: ReasoningState, userVerified: boolean): ReasoningStatus {
  const materialClash = state.conflicts.some((c) => c.code === 'MATERIAL_CONFLICT');
  const identityClash = state.conflicts.some((c) => c.code === 'IDENTITY_MISMATCH');
  if (materialClash) return 'CONFLICT';
  if (identityClash && !userVerified) return 'CONFLICT';
  if (userVerified && state.confidence.score >= 0.8) return 'CONFIRMED';
  if (state.confidence.score >= 0.75 && !identityClash) return 'LIKELY';
  return 'UNCERTAIN';
}

function stepFrom(
  state: ReasoningState,
  index: number,
  phase: ReasoningStepSummary['phase'],
  summary: string,
  extra: Partial<ReasoningStepSummary> = {},
): ReasoningStepSummary {
  return {
    index,
    phase,
    summary,
    hypothesisCount: state.hypotheses.length,
    conflictCount: state.conflicts.length,
    ...extra,
  };
}

export async function reasonAboutProduct(page: PlatformPageData): Promise<ReasoningState> {
  const userVerified = Boolean(page.identityUserVerified);
  let state = emptyState();
  let hitMaxSteps = false;

  for (let step = 1; step <= MAX_REASONING_STEPS; step += 1) {
    const action = planNextAction(state, step);
    state = { ...state, nextActions: [...state.nextActions.filter((a) => a.done), action] };

    if (action.type === 'OBSERVE') {
      const observations = observePage(page);
      const facts = extractFacts(observations);
      state = {
        ...state,
        observations,
        verifiedFacts: facts.verified,
        inferences: facts.inferred,
        observedFacts: facts.observed,
        unknowns: collectUnknowns(page, observations),
        steps: [
          ...state.steps,
          stepFrom(
            state,
            step,
            'OBSERVE',
            `OBSERVE collected ${observations.length} evidence records.`,
            {
              action: 'OBSERVE',
              expectedInformationGain: action.expectedInformationGain,
              reason: action.reason,
            },
          ),
        ],
      };
    } else if (action.type === 'HYPOTHESIZE') {
      const hypotheses = generateHypotheses(state.observations);
      state = {
        ...state,
        hypotheses,
        steps: [
          ...state.steps,
          stepFrom(
            { ...state, hypotheses },
            step,
            'GENERATE_HYPOTHESES',
            `GENERATE_HYPOTHESES produced ${hypotheses.length} candidates.`,
            {
              action: 'HYPOTHESIZE',
              expectedInformationGain: action.expectedInformationGain,
              reason: action.reason,
            },
          ),
        ],
      };
    } else if (action.type === 'CHECK') {
      const hypotheses = checkHypothesisEvidence(state.hypotheses, state.observations);
      const conflicts = detectConflicts(hypotheses, state.observations);
      state = {
        ...state,
        hypotheses,
        conflicts,
        steps: [
          ...state.steps,
          stepFrom(
            { ...state, hypotheses, conflicts },
            step,
            'CHECK_EVIDENCE',
            `CHECK_EVIDENCE found ${conflicts.length} conflicts.`,
            {
              action: 'CHECK',
              expectedInformationGain: action.expectedInformationGain,
              reason: action.reason,
            },
          ),
        ],
      };
    } else if (action.type === 'CHALLENGE') {
      state = reflect(state);
      const last = state.steps[state.steps.length - 1];
      if (last) {
        last.action = 'CHALLENGE';
        last.expectedInformationGain = action.expectedInformationGain;
        last.reason = action.reason;
        last.index = step;
      }
    } else if (action.type === 'REVISE') {
      state = revise(state);
      const last = state.steps[state.steps.length - 1];
      if (last) {
        last.action = 'REVISE';
        last.expectedInformationGain = action.expectedInformationGain;
        last.reason = action.reason;
        last.index = step;
      }
    } else if (action.type === 'CALL_TOOL' && action.tool === 'imageAnalyzer') {
      const imageUrls = state.observations.filter((e) => e.channel === 'IMAGE').map((e) => e.value);
      const result = await imageAnalyzer({ imageUrls });
      state = {
        ...state,
        tools: [...state.tools, result.invocation],
        steps: [
          ...state.steps,
          stepFrom(
            state,
            step,
            'CALL_TOOL',
            `CALL_TOOL imageAnalyzer → ${result.status} (gain ${action.expectedInformationGain ?? 0}).`,
            {
              action: 'CALL_TOOL:imageAnalyzer',
              expectedInformationGain: action.expectedInformationGain,
              reason: action.reason,
            },
          ),
        ],
      };
    } else if (action.type === 'CALL_TOOL' && action.tool === 'searchDataProvider') {
      const phrases = state.hypotheses.slice(0, 3).map((h) => h.label);
      const result = await searchDataProvider({ phrases });
      state = {
        ...state,
        tools: [...state.tools, result.invocation],
        steps: [
          ...state.steps,
          stepFrom(
            state,
            step,
            'CALL_TOOL',
            `CALL_TOOL searchDataProvider → ${result.status} (gain ${action.expectedInformationGain ?? 0}).`,
            {
              action: 'CALL_TOOL:searchDataProvider',
              expectedInformationGain: action.expectedInformationGain,
              reason: action.reason,
            },
          ),
        ],
      };
    } else if (action.type === 'FINALIZE') {
      const reason =
        action.goal === 'BEST_AVAILABLE' ? 'BEST_AVAILABLE_CONCLUSION' : action.reason || 'NO_INFORMATION_GAIN';
      state = {
        ...state,
        finalizeReason: reason,
        steps: [
          ...state.steps,
          stepFrom(state, step, 'FINALIZE', `FINALIZE: ${reason}`, {
            action: 'FINALIZE',
            expectedInformationGain: action.expectedInformationGain,
            reason: action.reason,
          }),
        ],
      };
      break;
    }

    if (step === MAX_REASONING_STEPS && !state.steps.some((s) => s.phase === 'FINALIZE')) {
      hitMaxSteps = true;
    }
  }

  if (!state.steps.some((s) => s.phase === 'FINALIZE')) {
    const reason = hitMaxSteps || state.steps.length >= MAX_REASONING_STEPS ? 'BEST_AVAILABLE_CONCLUSION' : 'NO_INFORMATION_GAIN';
    state = {
      ...state,
      finalizeReason: reason,
      steps: [
        ...state.steps,
        stepFrom(state, state.steps.length + 1, 'FINALIZE', `FINALIZE: ${reason}`, {
          action: 'FINALIZE',
          reason,
        }),
      ],
    };
  }

  const productHyps = topCandidates(state.hypotheses, 'product', 3);
  const categoryHyps = topCandidates(state.hypotheses, 'category', 3);
  const confidence = computeConfidence({
    productHyps,
    categoryHyps,
    conflicts: state.conflicts,
    unknowns: state.unknowns,
    verifiedCount: state.verifiedFacts.length,
    observedCount: state.observations.length,
    userVerified,
  });
  const productProfile = buildProductProfile({ ...state, confidence });
  const seo = planKeywords(page, productProfile);
  const status = statusFrom({ ...state, confidence, productProfile, seo }, userVerified);

  return {
    ...state,
    confidence,
    productProfile,
    seo: {
      ...seo,
      canProceed: seo.canProceed && status !== 'CONFLICT',
      autoApplyAllowed: false,
    },
    status,
    finalized: true,
    nextActions: [...state.nextActions.map((a) => ({ ...a, done: true })), ...suggestActions(status, state)],
  };
}

function suggestActions(status: ReasoningStatus, state: ReasoningState) {
  const actions = [];
  if (status === 'CONFLICT') {
    actions.push({
      id: 'n-confirm',
      type: 'FINALIZE' as const,
      summary: 'Manually confirm product identity before generating title or keywords.',
      done: false,
    });
  }
  if (state.unknowns.some((u) => u.slot === 'applications')) {
    actions.push({
      id: 'n-app',
      type: 'OBSERVE' as const,
      summary: 'Add an Application / Used-for specification on the listing.',
      done: false,
    });
  }
  if (state.unknowns.some((u) => u.slot === 'certifications')) {
    actions.push({
      id: 'n-cert',
      type: 'OBSERVE' as const,
      summary: 'Fill the certification field if a certificate exists; do not put ISO/CE only in keywords.',
      done: false,
    });
  }
  if (state.unknowns.some((u) => u.slot === 'materials')) {
    actions.push({
      id: 'n-mat',
      type: 'OBSERVE' as const,
      summary: 'Add a Material specification.',
      done: false,
    });
  }
  if (!state.tools.some((t) => t.tool === 'searchDataProvider')) {
    actions.push({
      id: 'n-search',
      type: 'CALL_TOOL' as const,
      tool: 'searchDataProvider' as const,
      summary: 'Official keyword Top3 stays empty until a verified search index is connected.',
      done: false,
    });
  }
  return actions;
}

export function runUniversalReasoning(page: PlatformPageData): Promise<ReasoningState> {
  return reasonAboutProduct(page);
}
