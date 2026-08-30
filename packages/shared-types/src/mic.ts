export const MIC_INTEGRATION_VERSION = 'MIC_INTEGRATION_2.0.0';
export const INQUIRY_ENGINE_VERSION = 'INQUIRY_ENGINE_1.0.0';
export const BUSINESS_INTELLIGENCE_VERSION = 'BUSINESS_INTELLIGENCE_1.0.0';

export const MIC_SYNC_MODES = ['MANUAL', 'INCREMENTAL'] as const;
export type MICSyncMode = (typeof MIC_SYNC_MODES)[number];

export const MIC_SYNC_STATUSES = ['PENDING', 'RUNNING', 'PARTIAL', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type MICSyncStatus = (typeof MIC_SYNC_STATUSES)[number];

export const MIC_MODULE_STATUSES = ['SUCCESS', 'NO_PERMISSION', 'PARSE_FAILED', 'SKIPPED'] as const;
export type MICModuleStatus = (typeof MIC_MODULE_STATUSES)[number];

export const MIC_ACCOUNT_ROLES = ['MAIN_ACCOUNT', 'SUB_ACCOUNT', 'UNKNOWN'] as const;
export type MICAccountRole = (typeof MIC_ACCOUNT_ROLES)[number];

export const MIC_PERMISSIONS = [
  'PRODUCT_VIEW',
  'PRODUCT_MANAGE',
  'INQUIRY_VIEW',
  'INQUIRY_REPLY',
  'SOURCING_VIEW',
  'CUSTOMER_MANAGE',
  'UNKNOWN',
] as const;
export type MICPermission = (typeof MIC_PERMISSIONS)[number];

export const MIC_PRODUCT_STATUSES = [
  'ONLINE',
  'PENDING_REVIEW',
  'NEEDS_MODIFICATION',
  'OFFLINE',
  'DRAFT',
  'UNKNOWN',
] as const;
export type MICProductStatus = (typeof MIC_PRODUCT_STATUSES)[number];

export const EVIDENCE_LEVELS = ['VERIFIED', 'INFERRED', 'UNKNOWN'] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const MIC_LOGIN_STATUSES = ['LOGGED_OUT', 'LOGGED_IN', 'VERIFY_REQUIRED', 'UNKNOWN'] as const;
export type MICLoginStatus = (typeof MIC_LOGIN_STATUSES)[number];

export interface MICAccountInfo {
  accountLabel: string;
  accountType: MICAccountRole;
  permissions: MICPermission[];
  lastLoginDetectedAt: string;
}

export interface MICProductRecord {
  micProductId: string;
  productName: string;
  productUrl: string;
  model: string;
  category: string;
  status: MICProductStatus;
  keywords: string[];
  attributes: Record<string, string>;
  tradeInfo: string;
  isFeaturedProduct: boolean;
  featuredScore: number | null;
  mainProductScore: number | null;
  updatedAtRemote: string | null;
  syncedAt: string;
  rawSourceHash: string;
  idConfidence: number;
  source: 'MIC_VIRTUAL_OFFICE';
  evidenceLevel: EvidenceLevel;
}

export interface MICInquiryRecord {
  micInquiryId: string;
  subject: string;
  buyerName: string;
  buyerCompany: string;
  buyerCountry: string;
  productId: string;
  productName: string;
  receivedAt: string | null;
  status: string;
  assignedAccount: string;
  messagePreview: string;
  lastReplyAt: string | null;
  syncedAt: string;
  idConfidence: number;
  source: 'MIC_VIRTUAL_OFFICE';
  evidenceLevel: EvidenceLevel;
}

export interface MICSourcingRequest {
  micRequestId: string;
  title: string;
  category: string;
  country: string;
  quantity: string;
  unit: string;
  publishedAt: string | null;
  deadline: string | null;
  status: string;
  matchingProducts: string[];
  syncedAt: string;
  idConfidence: number;
  source: 'MIC_VIRTUAL_OFFICE';
  evidenceLevel: EvidenceLevel;
}

export interface MICOpportunitySummary {
  newInquiries: number;
  unrepliedInquiries: number;
  highIntentInquiries: number;
  followUpNeeded: number;
  newBuyers: number;
  productInterestRanking: Array<{ productName: string; count: number }>;
  countryDistribution: Array<{ country: string; count: number }>;
  syncedAt: string;
  evidenceLevel: EvidenceLevel;
}

export interface MICModuleResult<T> {
  module: string;
  status: MICModuleStatus;
  records: T[];
  skippedUnchanged?: number;
}

export interface MICVirtualOfficeData {
  account: MICAccountInfo;
  products: MICProductRecord[];
  inquiries: MICInquiryRecord[];
  opportunities: MICOpportunitySummary;
  sourcingRequests: MICSourcingRequest[];
  syncMeta: {
    mode: MICSyncMode;
    modules: MICModuleResult<unknown>[];
    startedAt: string;
    source: 'MIC_VIRTUAL_OFFICE' | 'FIXTURE';
  };
}

export interface InquiryAnalysisResult {
  buyerIntent: string;
  productInterest: string;
  keyRequirements: string[];
  quantity: string;
  targetPrice: string;
  certificationNeeds: string[];
  customizationNeeds: string;
  deliveryNeeds: string;
  questions: string[];
  riskSignals: string[];
  nextAction: string;
  opportunityScore: number;
  evidenceLevel: EvidenceLevel;
}

export interface InquiryReplyDraft {
  english: string;
  chineseSummary: string;
  factsToConfirm: string[];
  followUpQuestions: string[];
  cta: string;
  autoSend: false;
}

export interface RFQMatchResult {
  productId: string;
  productName: string;
  score: number;
  reasons: string[];
  evidenceLevel: EvidenceLevel;
}

export interface QuoteDraft {
  coverMessage: string;
  recommendedProducts: string[];
  questions: string[];
  quoteStructure: string[];
  priceStatus: 'PRICE_REQUIRED' | 'HAS_REFERENCE';
  autoSend: false;
}
