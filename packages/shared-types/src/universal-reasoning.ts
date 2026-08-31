export const UPI_VERSION = 'UPI_1.0.0';
export const UPI_CONFIDENCE_FORMULA_VERSION = 'UPI_CONF_1.0.0';

export const FACT_STATUSES = ['OBSERVED', 'VERIFIED', 'INFERRED', 'UNKNOWN'] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

export const EVIDENCE_CHANNELS = [
  'TITLE',
  'PRODUCT_NAME',
  'CATEGORY',
  'SPEC',
  'DESCRIPTION',
  'CERTIFICATION_FIELD',
  'KEYWORDS',
  'IMAGE',
  'SEARCH',
  'USER',
] as const;
export type EvidenceChannel = (typeof EVIDENCE_CHANNELS)[number];

export const EVIDENCE_TIERS = ['SELLER_INPUT', 'STRUCTURED_FIELD', 'RELIABLE', 'EXTERNAL', 'USER'] as const;
export type EvidenceTier = (typeof EVIDENCE_TIERS)[number];

export const REASONING_PHASES = [
  'OBSERVE',
  'GENERATE_HYPOTHESES',
  'CHECK_EVIDENCE',
  'CHALLENGE',
  'PLAN_NEXT_ACTION',
  'REVISE',
  'FINALIZE',
] as const;
export type ReasoningPhase = (typeof REASONING_PHASES)[number];

export const REASONING_STATUSES = [
  'RUNNING',
  'CONFIRMED',
  'LIKELY',
  'UNCERTAIN',
  'CONFLICT',
  'BEST_AVAILABLE_CONCLUSION',
] as const;
export type ReasoningStatus = (typeof REASONING_STATUSES)[number];

export const TOOL_STATUSES = ['OK', 'UNAVAILABLE', 'TIMEOUT', 'ERROR', 'SKIPPED'] as const;
export type ToolStatus = (typeof TOOL_STATUSES)[number];

export interface EvidenceRecord {
  id: string;
  channel: EvidenceChannel;
  tier: EvidenceTier;
  field: string;
  value: string;
  excerpt: string;
}

export interface FactRecord {
  id: string;
  kind: 'identity' | 'attribute' | 'function' | 'application' | 'material' | 'specification' | 'certification' | 'component' | 'visual';
  label: string;
  value: string;
  status: FactStatus;
  evidenceIds: string[];
}

export interface IdentityHypothesis {
  id: string;
  label: string;
  kind: 'product' | 'category';
  prior: number;
  posterior: number;
  supportingEvidence: string[];
  opposingEvidence: string[];
  rationale: string;
  rejected?: boolean;
  rejectReason?: string;
}

export interface ReasoningConflict {
  id: string;
  code: 'IDENTITY_MISMATCH' | 'MATERIAL_CONFLICT' | 'UNSUPPORTED_CLAIM' | 'SOURCE_DISAGREEMENT';
  summary: string;
  left: string;
  right: string;
  evidenceIds: string[];
}

export interface UnknownRecord {
  id: string;
  slot: string;
  reason: string;
  blocking: boolean;
}

export interface ConfidenceFactors {
  titleSpecAgreement: number;
  categoryAgreement: number;
  evidenceCoverage: number;
  conflictPenalty: number;
  unknownPenalty: number;
  sellerInputOnlyPenalty: number;
}

export interface ConfidenceReport {
  score: number;
  interval: { low: number; high: number };
  factors: ConfidenceFactors;
  formulaVersion: string;
  notes: string[];
}

export interface ReasoningAction {
  id: string;
  type: 'OBSERVE' | 'HYPOTHESIZE' | 'CHECK' | 'CHALLENGE' | 'CALL_TOOL' | 'REVISE' | 'FINALIZE';
  tool?: 'imageAnalyzer' | 'searchDataProvider';
  summary: string;
  done: boolean;
}

export interface ToolInvocation {
  tool: 'imageAnalyzer' | 'searchDataProvider';
  status: ToolStatus;
  attempts: number;
  inputHash: string;
  message: string;
}

export interface ReasoningStepSummary {
  index: number;
  phase: ReasoningPhase;
  summary: string;
  hypothesisCount: number;
  conflictCount: number;
}

export interface DynamicAttribute {
  name: string;
  value: string;
  status: FactStatus;
  evidenceIds: string[];
}

export interface UniversalProductProfile {
  identity: {
    label: string;
    status: FactStatus;
    candidates: IdentityHypothesis[];
    evidenceIds: string[];
  };
  categoryCandidates: IdentityHypothesis[];
  dynamicAttributes: DynamicAttribute[];
  functions: FactRecord[];
  applications: FactRecord[];
  materials: FactRecord[];
  specifications: Record<string, string>;
  certifications: FactRecord[];
  components: FactRecord[];
  visualFacts: FactRecord[];
  evidence: EvidenceRecord[];
  conflicts: ReasoningConflict[];
  confidence: ConfidenceReport;
}

export interface SeoContinuation {
  canProceed: boolean;
  autoApplyAllowed: boolean;
  officialTop3: string[];
  candidateKeywords: Array<{
    keyword: string;
    status: 'PENDING_VERIFICATION' | 'BLOCKED' | 'ELIGIBLE';
    reasons: string[];
  }>;
  searchDemand: 'UNKNOWN' | 'NOT_AVAILABLE';
  note: string;
}

export interface ReasoningState {
  observations: EvidenceRecord[];
  verifiedFacts: FactRecord[];
  inferences: FactRecord[];
  observedFacts: FactRecord[];
  hypotheses: IdentityHypothesis[];
  rejectedHypotheses: IdentityHypothesis[];
  conflicts: ReasoningConflict[];
  unknowns: UnknownRecord[];
  nextActions: ReasoningAction[];
  confidence: ConfidenceReport;
  status: ReasoningStatus;
  productProfile: UniversalProductProfile;
  seo: SeoContinuation;
  steps: ReasoningStepSummary[];
  tools: ToolInvocation[];
  version: string;
  finalized: boolean;
}

export interface UniversalReasonPayload {
  reasoning: ReasoningState;
  productProfile: UniversalProductProfile;
  seo: SeoContinuation;
}
