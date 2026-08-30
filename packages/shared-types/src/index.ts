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

export interface DiagnosisIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  suggestion: string;
  scoreImpact: number;
}

export interface DiagnosisScores {
  micSeo: number;
  googleSeo: number;
  geo: number;
  contentQuality: number;
  b2bConversion: number;
  compliance?: number | null;
}

export interface DiagnosisResult {
  diagnosisId: string;
  totalScore: number;
  scores: DiagnosisScores;
  issues: DiagnosisIssue[];
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
    ...overrides,
  };
}
