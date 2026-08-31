import type { PlatformPageData, ReasoningState, ReasoningStatus } from '@trade-ai/shared-types';
import { UPI_VERSION } from '@trade-ai/shared-types';
import { computeConfidence } from './confidence';
import { checkHypothesisEvidence, detectConflicts } from './conflicts';
import { generateHypotheses, topCandidates } from './hypothesis';
import { observePage } from './observe';
import { planNextAction } from './planner';
import { buildProductProfile } from './product-profile';
import { reflect, revise } from './reflector';
import { collectUnknowns, extractFacts } from './state';
import { imageAnalyzer, searchDataProvider } from './tools';
import { planKeywords } from '../seo/keyword-intelligence';

const MAX_STEPS = 5;

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

export async function reasonAboutProduct(page: PlatformPageData): Promise<ReasoningState> {
  const userVerified = Boolean(page.identityUserVerified);
  let state = emptyState();

  for (let step = 1; step <= MAX_STEPS; step += 1) {
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
          {
            index: step,
            phase: 'OBSERVE',
            summary: `Collected ${observations.length} evidence records.`,
            hypothesisCount: 0,
            conflictCount: 0,
          },
        ],
      };
    } else if (action.type === 'HYPOTHESIZE') {
      const hypotheses = generateHypotheses(state.observations);
      state = {
        ...state,
        hypotheses,
        steps: [
          ...state.steps,
          {
            index: step,
            phase: 'GENERATE_HYPOTHESES',
            summary: `Generated ${hypotheses.length} hypotheses.`,
            hypothesisCount: hypotheses.length,
            conflictCount: 0,
          },
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
          {
            index: step,
            phase: 'CHECK_EVIDENCE',
            summary: `Checked evidence; ${conflicts.length} conflicts.`,
            hypothesisCount: hypotheses.length,
            conflictCount: conflicts.length,
          },
        ],
      };
    } else if (action.type === 'CHALLENGE') {
      state = reflect(state);
    } else if (action.type === 'REVISE') {
      state = revise(state);
    } else if (action.type === 'FINALIZE') {
      break;
    }
  }

  if (!state.tools.some((t) => t.tool === 'imageAnalyzer')) {
    const result = await imageAnalyzer({ imageUrls: page.images ?? [] });
    state = { ...state, tools: [...state.tools, result.invocation] };
  }
  if (!state.tools.some((t) => t.tool === 'searchDataProvider')) {
    const result = await searchDataProvider({
      phrases: state.hypotheses.slice(0, 3).map((h) => h.label),
    });
    state = { ...state, tools: [...state.tools, result.invocation] };
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
    steps: [
      ...state.steps,
      {
        index: state.steps.length + 1,
        phase: 'FINALIZE',
        summary: 'challengeConclusion applied; BEST_AVAILABLE_CONCLUSION with computed confidence.',
        hypothesisCount: productHyps.length,
        conflictCount: state.conflicts.length,
      },
    ],
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
  actions.push({
    id: 'n-search',
    type: 'CALL_TOOL' as const,
    tool: 'searchDataProvider' as const,
    summary: 'Official keyword Top3 stays empty until a verified search index is connected.',
    done: false,
  });
  return actions;
}

export function runUniversalReasoning(page: PlatformPageData): Promise<ReasoningState> {
  return reasonAboutProduct(page);
}
