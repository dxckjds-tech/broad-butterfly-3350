export const PLATFORMS = ['MADE_IN_CHINA', 'ALIBABA', 'INDEPENDENT_SITE'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PAGE_TYPES = ['PRODUCT', 'SHOP', 'UNKNOWN'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

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
  fieldsFound: string[];
  fieldsMissing: string[];
  matchedSelectors: Record<string, string>;
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

export const RULES_VERSION = 'MIC_RULES_1.0.0';

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
    ...overrides,
  };
}
