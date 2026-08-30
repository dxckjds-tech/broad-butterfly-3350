export { analyzeInquiry, draftInquiryReply } from './analysis';
export { inquiryOpportunityScore, markHighIntent } from './opportunity-score';
export { matchRfqToProducts, draftQuote } from './rfq-match';
export { businessPriorityScore } from './business-priority';
export { applyIncrementalProducts, emptyCursor, finalizeJobStatus } from './sync';
export { weeklyPlanWithInquirySignals } from './weekly-plan';
export const INQUIRY_ENGINE_VERSION = 'INQUIRY_ENGINE_1.0.0';
export const BUSINESS_INTELLIGENCE_VERSION = 'BUSINESS_INTELLIGENCE_1.0.0';
