import { geoAnalyzer, type GeoAnalysisResult } from '@trade-ai/geo-engine';
import { analyzeMicPage, inspectProductIdentity } from '@trade-ai/mic-rule-engine';
import { seoAnalyzer, type SeoAnalysisResult } from '@trade-ai/seo-engine';
import {
  SCORE_WEIGHTS,
  type DiagnosisIssue,
  type DiagnosisResult,
  type DiagnosisScores,
  type IssueCategory,
  type PlatformPageData,
} from '@trade-ai/shared-types';
import { reasonAboutProduct } from '@trade-ai/universal-product-intelligence';

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreForCategory(issues: DiagnosisIssue[], category: IssueCategory): number {
  const penalty = issues
    .filter((issue) => issue.category === category)
    .reduce((sum, issue) => sum + issue.scoreImpact, 0);
  return clampScore(100 - penalty);
}

export function computeScores(issues: DiagnosisIssue[]): DiagnosisScores {
  return {
    micSeo: scoreForCategory(issues, 'MIC_SEO'),
    googleSeo: scoreForCategory(issues, 'GOOGLE_SEO'),
    geo: scoreForCategory(issues, 'GEO'),
    contentQuality: scoreForCategory(issues, 'CONTENT'),
    b2bConversion: scoreForCategory(issues, 'CONVERSION'),
    compliance: scoreForCategory(issues, 'COMPLIANCE'),
  };
}

export function computeTotalScore(scores: DiagnosisScores): number {
  return clampScore(
    scores.micSeo * SCORE_WEIGHTS.micSeo +
      scores.googleSeo * SCORE_WEIGHTS.googleSeo +
      scores.geo * SCORE_WEIGHTS.geo +
      scores.contentQuality * SCORE_WEIGHTS.contentQuality +
      scores.b2bConversion * SCORE_WEIGHTS.b2bConversion,
  );
}

export interface DiagnosisEngineOutput {
  result: Omit<DiagnosisResult, 'diagnosisId'> & { diagnosisId?: string };
  seo: SeoAnalysisResult;
  geo: GeoAnalysisResult;
}

export async function diagnosePage(page: PlatformPageData): Promise<DiagnosisEngineOutput> {
  const issues = analyzeMicPage(page);
  const scores = computeScores(issues);
  const totalScore = computeTotalScore(scores);
  const [seo, geo] = await Promise.all([seoAnalyzer.analyze(page), geoAnalyzer.analyze(page)]);
  const identity = inspectProductIdentity(page);
  const universalReasoning = await reasonAboutProduct(page);

  return {
    result: {
      totalScore,
      scores,
      issues,
      productTruthProfile: identity.profile,
      identityConflict: identity.conflict,
      keywordRecommendationsPaused: identity.keywordRecommendationsPaused,
      universalReasoning,
    },
    seo,
    geo,
  };
}
