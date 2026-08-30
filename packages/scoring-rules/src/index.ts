import type { DiagnosisIssue, DiagnosisResult, PlatformPageData } from '@trade-ai/shared-types';
import { RULES_VERSION } from './config';
import { buildRuleContext } from './engine/context';
import { evaluateAllRules } from './engine/evaluate';
import { dedupeIssues, resultsToIssues, scoreFromRules, sortIssues, totalScore } from './engine/score';
import { RULE_REGISTRY } from './engine/registry';

export { RULES_VERSION, PARSE_QUALITY_LOW, PARSE_QUALITY_UNCERTAIN } from './config';
export { micConfig } from './config/mic.config';
export { contentConfig } from './config/content.config';
export { conversionConfig } from './config/conversion.config';
export { RULE_REGISTRY } from './engine/registry';
export { detectProductTypeProfile, isCustomizationRelevant } from './engine/product-type';
export { detectCoreProductTerm } from './engine/core-term';
export { evaluateAllRules } from './engine/evaluate';
export { buildRuleContext } from './engine/context';
export { dedupeIssues, sortIssues } from './engine/score';

export function evaluateDiagnosis(page: PlatformPageData): Omit<DiagnosisResult, 'diagnosisId'> {
  const ctx = buildRuleContext(page);
  const ruleResults = evaluateAllRules(ctx);
  const { scores, scoreDetails, diagnosisConfidence } = scoreFromRules(ruleResults, ctx);
  const issues = dedupeIssues(resultsToIssues(ruleResults));
  const sorted = sortIssues(issues);
  return {
    totalScore: totalScore(scores),
    scores,
    issues: sorted,
    topIssues: sorted.slice(0, 5),
    diagnosisConfidence,
    rulesVersion: RULES_VERSION,
    ruleResults,
    productTypeProfile: ctx.profile,
    scoreDetails,
    parseQualityScore: ctx.parseScore,
  };
}

export function runScoringRules(page: PlatformPageData): DiagnosisIssue[] {
  return evaluateDiagnosis(page).issues;
}

export function listScoringRules(): Array<Record<string, string>> {
  return RULE_REGISTRY.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    priority: item.priority,
    version: item.version,
    enabled: String(item.enabled),
    title: item.name,
    description: item.description,
    severity: item.priority === 'P0' ? 'CRITICAL' : item.priority === 'P1' ? 'HIGH' : item.priority === 'P2' ? 'MEDIUM' : 'LOW',
  }));
}

