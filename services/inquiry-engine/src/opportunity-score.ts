import type { InquiryAnalysisResult, MICInquiryRecord } from '@trade-ai/shared-types';
import { analyzeInquiry } from './analysis';

export function inquiryOpportunityScore(record: MICInquiryRecord, analysis?: InquiryAnalysisResult): number {
  return (analysis ?? analyzeInquiry(record)).opportunityScore;
}

export function markHighIntent(inquiries: MICInquiryRecord[]): string[] {
  return inquiries.filter((i) => analyzeInquiry(i).buyerIntent === 'HIGH').map((i) => i.micInquiryId);
}
