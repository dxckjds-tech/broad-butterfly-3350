export const PLATFORMS = ['MADE_IN_CHINA', 'ALIBABA', 'INDEPENDENT_SITE'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PAGE_TYPES = [
  'PRODUCT',
  'SHOP',
  'MIC_PRODUCT_EDIT',
  'MIC_PRODUCT_LIST',
  'MIC_INQUIRY_LIST',
  'MIC_INQUIRY_DETAIL',
  'MIC_VIRTUAL_OFFICE',
  'UNKNOWN',
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const DIAGNOSIS_MODES = ['PUBLIC_PAGE', 'BACKEND_EDIT', 'BACKEND_LIST'] as const;
export type DiagnosisMode = (typeof DIAGNOSIS_MODES)[number];

export const FIELD_EVIDENCE_SOURCES = [
  'BACKEND_FORM',
  'BACKEND_TEXT',
  'PUBLIC_PAGE',
  'INFERRED',
  'UNKNOWN',
] as const;
export type FieldEvidenceSource = (typeof FIELD_EVIDENCE_SOURCES)[number];

export const SECTION_LOAD_STATES = ['LOADED', 'PARTIAL', 'NOT_LOADED'] as const;
export type SectionLoadState = (typeof SECTION_LOAD_STATES)[number];

export const CATEGORY_RELEVANCE_STATES = ['MATCH', 'POSSIBLE_MISMATCH', 'MISMATCH', 'UNCERTAIN'] as const;
export type CategoryRelevanceStatus = (typeof CATEGORY_RELEVANCE_STATES)[number];

export const ISSUE_CATEGORIES = [
  'MIC_SEO',
  'GOOGLE_SEO',
  'GEO',
  'CONTENT',
  'CONVERSION',
  'COMPLIANCE',
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const DIAGNOSIS_STATES = [
  'UNRECOGNIZED',
  'READY',
  'ANALYZING',
  'SUCCESS',
  'FAILED',
  'OFFLINE',
  'CAPTURE_FAILED',
] as const;
export type DiagnosisUiState = (typeof DIAGNOSIS_STATES)[number];

export const FIELD_STATUSES = ['FOUND', 'MISSING', 'UNCERTAIN'] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

export const PARSE_QUALITY_FIELDS = [
  'productName',
  'companyName',
  'description',
  'images',
  'specifications',
  'moq',
  'deliveryTime',
  'oemAvailable',
  'certifications',
  'category',
] as const;
export type ParseQualityField = (typeof PARSE_QUALITY_FIELDS)[number];

export const PARSE_QUALITY_WEIGHTS: Record<ParseQualityField, number> = {
  productName: 20,
  companyName: 15,
  description: 15,
  images: 10,
  specifications: 15,
  moq: 5,
  deliveryTime: 5,
  oemAvailable: 5,
  certifications: 5,
  category: 5,
};

export type FieldStatusMap = Partial<
  Record<ParseQualityField | 'keywords' | 'rawText', FieldStatus>
>;

export interface ParseQuality {
  score: number;
  foundFields: string[];
  missingFields: string[];
  warnings: string[];
}

export interface ParseDebugResult {
  detectedPageType: PageType;
  pageTypeConfidence?: number;
  fieldsFound: string[];
  fieldsMissing: string[];
  matchedSelectors: Record<string, string>;
  title?: string;
  category?: string;
  keywords?: string[];
  centerTerms?: string[];
  specifications?: Record<string, string>;
  images?: string[];
  moq?: string;
  deliveryTime?: string;
  oem?: boolean | null;
  sectionAvailability?: Record<string, SectionLoadState>;
  fieldSource?: Record<string, FieldEvidenceSource>;
  parseConfidence?: number;
}

export interface DataReadinessItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface DataReadiness {
  score: number;
  items: DataReadinessItem[];
}

export interface SpecIgnoreItem {
  field: string;
  value: string;
  reason: string;
}

export interface SpecParseDebug {
  rawSpecificationCount: number;
  meaningfulSpecificationCount: number;
  ignoredSpecifications: SpecIgnoreItem[];
}

export interface CategoryRelevanceAnalysis {
  status: CategoryRelevanceStatus;
  title: string;
  category: string;
  message: string;
}

export interface ProductContentState {
  draft: Record<string, string>;
  published: Record<string, string>;
  difference: string[];
}

export interface PlatformPageData {
  platform: Platform | 'UNKNOWN';
  pageType: PageType;
  url: string;
  title: string;
  companyName: string;
  productName: string;
  description: string;
  keywords: string[];
  images: string[];
  specifications: Record<string, string>;
  category: string;
  moq: string;
  deliveryTime: string;
  oemAvailable: boolean;
  certifications: string[];
  rawText: string;
  capturedAt: string;
  fieldStatus?: FieldStatusMap;
  parseQuality?: ParseQuality;
  parseDebug?: ParseDebugResult | null;
  pageTypeConfidence?: number;
  diagnosisMode?: DiagnosisMode;
  adapterVersion?: string;
  primaryKeywords?: string[];
  keywordCount?: number;
  centerTerms?: string[];
  centerTermCount?: number;
  categorySource?: string;
  categoryRelevance?: CategoryRelevanceAnalysis;
  specDebug?: SpecParseDebug;
  sectionAvailability?: Record<string, SectionLoadState>;
  fieldEvidence?: Record<string, FieldEvidenceSource>;
  dataReadiness?: DataReadiness;
  productContentState?: ProductContentState;
  identityUserVerified?: boolean;
}

export const SCORE_WEIGHTS = {
  micSeo: 0.25,
  googleSeo: 0.2,
  geo: 0.2,
  contentQuality: 0.2,
  b2bConversion: 0.15,
} as const;

export const SEVERITY_PENALTY: Record<IssueSeverity, number> = {
  CRITICAL: 20,
  HIGH: 12,
  MEDIUM: 6,
  LOW: 3,
};

export const RULES_VERSION = 'MIC_RULES_1.1.0';

export const RULE_STATUSES = ['PASS', 'FAIL', 'UNCERTAIN', 'SKIPPED'] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const ISSUE_PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const SUGGESTION_TYPES = ['FIX', 'ENHANCEMENT'] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

export const PRODUCT_TYPE_PROFILES = [
  'GENERAL',
  'MACHINERY',
  'INDUSTRIAL_COMPONENT',
  'CONSUMER_GOODS',
  'CUSTOM_MANUFACTURING',
] as const;
export type ProductTypeProfile = (typeof PRODUCT_TYPE_PROFILES)[number];

export const KEYWORD_GATE_STATUSES = [
  'PRIMARY_ELIGIBLE',
  'SAFE_PRIMARY_CANDIDATE',
  'SAFE_SECONDARY',
  'REVIEW_REQUIRED',
  'REJECTED',
  'REJECTED_PRODUCT_MISMATCH',
] as const;
export type KeywordGateStatus = (typeof KEYWORD_GATE_STATUSES)[number];

export const BLOCKED_KEYWORD_REASONS = [
  'PRODUCT_MISMATCH',
  'UNVERIFIED_ATTRIBUTE',
  'APPLICATION_UNVERIFIED',
  'CERTIFICATION_UNVERIFIED',
  'BLOCKED_BY_FACT_GUARD',
] as const;
export type BlockedKeywordReason = (typeof BLOCKED_KEYWORD_REASONS)[number];

export const SEARCH_EVIDENCE_STATUSES = ['VERIFIED', 'UNVERIFIED', 'MISSING'] as const;
export type SearchEvidenceStatus = (typeof SEARCH_EVIDENCE_STATUSES)[number];

export interface ProductTruthEvidence {
  field: string;
  value: string;
  source: FieldEvidenceSource | 'TITLE' | 'SPEC' | 'KEYWORD' | 'DESCRIPTION' | 'CATEGORY';
}

export interface ProductMatchBreakdown {
  core: number;
  family: number;
  attributes: number;
  applications: number;
  evidence: number;
}

export interface ProductMatchScore {
  total: number;
  breakdown: ProductMatchBreakdown;
}

export interface SearchEvidence {
  keyword: string;
  status: SearchEvidenceStatus;
  demand: number | 'UNKNOWN';
  source?: string;
}

export interface BlockedKeyword {
  keyword: string;
  reasons: BlockedKeywordReason[];
  note: string;
  matchScore: number;
}

export interface GatedKeyword {
  keyword: string;
  matchScore: number;
  breakdown: ProductMatchBreakdown;
  status: KeywordGateStatus;
  blockedReasons: BlockedKeywordReason[];
  searchEvidence: SearchEvidence;
  officialTop3Eligible: boolean;
}

export interface ProductIdentityConflict {
  code: 'PRODUCT_IDENTITY_CONFLICT';
  hasConflict: boolean;
  titleProduct: string;
  categoryProduct: string;
  keywordProducts: string[];
  specProduct: string;
  descriptionProduct: string;
  summary: string;
  keywordRecommendationsPaused: boolean;
}

export interface ProductTruthProfile {
  coreProduct: string;
  productFamily: string;
  productType: string;
  verifiedAttributes: string[];
  specifications: Record<string, string>;
  applications: string[];
  materials: string[];
  certifications: string[];
  capabilities: string[];
  unverifiedClaims: string[];
  conflictingClaims: string[];
  evidence: ProductTruthEvidence[];
  identityConfidence: number;
  userVerified: boolean;
}

export interface ProductIdentityInspectPayload {
  profile: ProductTruthProfile;
  conflict: ProductIdentityConflict | null;
  keywordRecommendationsPaused: boolean;
  currentKeywordGate: GatedKeyword[];
  blockedKeywords: BlockedKeyword[];
}

export const DIAGNOSIS_CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type DiagnosisConfidenceLevel = (typeof DIAGNOSIS_CONFIDENCE_LEVELS)[number];

export interface DiagnosisConfidence {
  score: number;
  level: DiagnosisConfidenceLevel;
}

export interface RuleResult {
  ruleId: string;
  category: IssueCategory;
  status: RuleStatus;
  confidence: number;
  severity: IssueSeverity;
  priority: IssuePriority;
  title: string;
  description: string;
  suggestion: string;
  suggestionType: SuggestionType;
  scoreImpact: number;
  evidence: Record<string, unknown>;
  fieldSource?: string;
  relatedRuleIds?: string[];
}

export interface RuleRegistryEntry {
  id: string;
  name: string;
  category: IssueCategory;
  priority: IssuePriority;
  enabled: boolean;
  version: string;
}

export interface DiagnosisIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  suggestion: string;
  scoreImpact: number;
  evidence?: Record<string, unknown>;
  priority?: IssuePriority;
  suggestionType?: SuggestionType;
  relatedRuleIds?: string[];
  confidence?: number;
  fieldSource?: string;
  status?: RuleStatus;
  collapsedTitle?: string;
}

export interface DimensionBreakdown {
  titleQuality?: number;
  topicClarity?: number;
  contentRelevance?: number;
  specificationQuality?: number;
  categoryEntity?: number;
  other?: number;
  descriptionQuality?: number;
  imageQuality?: number;
  evidenceDensity?: number;
  inquiryReadiness?: number;
  customization?: number;
  keywordCoverage?: number;
  entityClarity?: number;
}

export interface CategoryScoreDetail {
  score: number;
  confidence: number;
  breakdown: DimensionBreakdown;
}

export interface DiagnosisScores {
  micSeo: number;
  googleSeo: number;
  geo: number;
  contentQuality: number;
  b2bConversion: number;
  compliance?: number | null;
}

export interface DiagnosisScoreDetails {
  micSeo: CategoryScoreDetail;
  googleSeo: CategoryScoreDetail;
  geo: CategoryScoreDetail;
  contentQuality: CategoryScoreDetail;
  b2bConversion: CategoryScoreDetail;
}

export interface DiagnosisResult {
  diagnosisId: string;
  totalScore: number;
  scores: DiagnosisScores;
  issues: DiagnosisIssue[];
  topIssues?: DiagnosisIssue[];
  diagnosisConfidence?: DiagnosisConfidence;
  rulesVersion?: string;
  ruleResults?: RuleResult[];
  productTypeProfile?: ProductTypeProfile;
  scoreDetails?: DiagnosisScoreDetails;
  parseQualityScore?: number;
  productTruthProfile?: ProductTruthProfile;
  identityConflict?: ProductIdentityConflict | null;
  keywordRecommendationsPaused?: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  message: string;
  code: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthPayload {
  status: 'ok';
  service: string;
}

export interface AiHealthPayload {
  provider: string;
  model: string;
  status: 'connected' | 'unavailable' | 'mock';
  latency: number;
}

export type TitleOptimizeStyle = 'SEO_BALANCED' | 'BUYER_INTENT' | 'GEO_FRIENDLY';

export interface RecommendedTitle {
  style: TitleOptimizeStyle;
  title: string;
  reason: string;
  usedFacts: string[];
  warnings: string[];
}

export interface TitleOptimizePayload {
  originalTitle: string;
  coreProductTerm: string;
  problems: string[];
  recommendedTitles: RecommendedTitle[];
  keywordSuggestions: string[];
  factGuard: {
    ok: boolean;
    warnings: string[];
    removed: Array<{ key: string; value: string }>;
  };
  meta: {
    taskType: string;
    provider: string;
    model: string;
    latency: number;
    inputTokens: number;
    outputTokens: number;
    status: string;
    promptVersion: string;
    cached: boolean;
    engineVersion: string;
  };
}

export interface KeywordSuggestion {
  keyword: string;
  reason: string;
  usedFacts: string[];
  warnings: string[];
  priority?: 'HIGH' | 'MEDIUM';
}

export interface MicKeywordSuggestion {
  keyword: string;
  priority: 'HIGH' | 'MEDIUM';
  reason: string;
  matchScore?: number;
  gateStatus?: KeywordGateStatus;
}

export interface KeywordOptimizePayload {
  currentKeywords: string[];
  problems: string[];
  primaryKeywords: KeywordSuggestion[];
  secondaryKeywords: KeywordSuggestion[];
  buyerIntentKeywords: KeywordSuggestion[];
  applicationKeywords: KeywordSuggestion[];
  micKeywords: MicKeywordSuggestion[];
  officialTop3: GatedKeyword[];
  gatedKeywords: GatedKeyword[];
  blockedKeywords: BlockedKeyword[];
  identityConflict: ProductIdentityConflict | null;
  productTruthProfile: ProductTruthProfile;
  keywordRecommendationsPaused: boolean;
  searchDemand: 'UNKNOWN';
  factGuard: {
    ok: boolean;
    warnings: string[];
    removed: Array<{ key: string; value: string }>;
  };
  meta: {
    taskType: string;
    provider: string;
    model: string;
    latency: number;
    inputTokens: number;
    outputTokens: number;
    status: string;
    promptVersion: string;
    cached: boolean;
    engineVersion: string;
  };
}

export type CategoryCheckVerdict = CategoryRelevanceStatus;

export interface CategoryCheckPayload {
  currentCategory: string;
  verdict: CategoryCheckVerdict;
  confidence: number;
  reason: string;
  suggestedCategoryConcept: string;
  usedFacts: string[];
  factGuard: {
    ok: boolean;
    warnings: string[];
    removed: Array<{ key: string; value: string }>;
  };
  meta: {
    taskType: string;
    provider: string;
    model: string;
    latency: number;
    inputTokens: number;
    outputTokens: number;
    status: string;
    promptVersion: string;
    cached: boolean;
    engineVersion: string;
  };
}

export type DescriptionSectionHeading =
  | 'OVERVIEW'
  | 'SPECIFICATIONS'
  | 'APPLICATIONS'
  | 'CUSTOMIZATION'
  | 'PACKING';

export interface DescriptionSection {
  heading: DescriptionSectionHeading;
  title: string;
  body: string;
}

export interface DescriptionOptimizePayload {
  originalDescription: string;
  problems: string[];
  sections: DescriptionSection[];
  recommendedDescription: string;
  factGuard: {
    ok: boolean;
    warnings: string[];
    removed: Array<{ key: string; value: string }>;
  };
  meta: {
    taskType: string;
    provider: string;
    model: string;
    latency: number;
    inputTokens: number;
    outputTokens: number;
    status: string;
    promptVersion: string;
    cached: boolean;
    engineVersion: string;
  };
}

export type GeoVerdict = 'STRONG' | 'PARTIAL' | 'WEAK' | 'UNCERTAIN';

export type GeoGapDimension =
  | 'PRODUCT_ENTITY'
  | 'COMPANY_ENTITY'
  | 'SPECIFICATIONS'
  | 'APPLICATIONS'
  | 'FAQ'
  | 'EVIDENCE'
  | 'CERTIFICATIONS'
  | 'OEM'
  | 'BUYER_INTENT';

export type GeoGapStatus = 'PRESENT' | 'WEAK' | 'MISSING';

export interface GeoGap {
  dimension: GeoGapDimension;
  status: GeoGapStatus;
  note: string;
}

export interface GeoRecommendation {
  title: string;
  body: string;
}

export interface GeoFaqSuggestion {
  question: string;
  answer: string;
}

export interface GeoAnalysisPayload {
  productEntity: string;
  companyEntity: string;
  verdict: GeoVerdict;
  score: number;
  summary: string;
  gaps: GeoGap[];
  recommendations: GeoRecommendation[];
  faqSuggestions: GeoFaqSuggestion[];
  factGuard: {
    ok: boolean;
    warnings: string[];
    removed: Array<{ key: string; value: string }>;
  };
  meta: {
    taskType: string;
    provider: string;
    model: string;
    latency: number;
    inputTokens: number;
    outputTokens: number;
    status: string;
    promptVersion: string;
    cached: boolean;
    engineVersion: string;
  };
}

export interface ShopSummary {
  id: string;
  companyName: string;
  platform: string;
  shopUrl: string;
  totalScore: number | null;
  micSeo: number | null;
  googleSeo: number | null;
  geo: number | null;
  lastDiagnosisAt: string | null;
  pilot?: boolean;
}

export interface DashboardStats {
  shopCount: number;
  productCount: number;
  averageHealth: number;
  criticalIssueCount: number;
  averageMicSeo: number;
  averageGeo: number;
}

export * from './mic';

export function emptyPageData(overrides: Partial<PlatformPageData> = {}): PlatformPageData {
  return {
    platform: 'UNKNOWN',
    pageType: 'UNKNOWN',
    url: '',
    title: '',
    companyName: '',
    productName: '',
    description: '',
    keywords: [],
    images: [],
    specifications: {},
    category: '',
    moq: '',
    deliveryTime: '',
    oemAvailable: false,
    certifications: [],
    rawText: '',
    capturedAt: new Date().toISOString(),
    fieldStatus: {},
    parseQuality: undefined,
    parseDebug: null,
    pageTypeConfidence: 0,
    diagnosisMode: 'PUBLIC_PAGE',
    adapterVersion: undefined,
    primaryKeywords: [],
    keywordCount: 0,
    centerTerms: [],
    centerTermCount: 0,
    categorySource: undefined,
    categoryRelevance: undefined,
    specDebug: undefined,
    sectionAvailability: undefined,
    fieldEvidence: undefined,
    dataReadiness: undefined,
    productContentState: undefined,
    ...overrides,
  };
}
