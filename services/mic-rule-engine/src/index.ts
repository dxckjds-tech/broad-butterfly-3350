import { listScoringRules, runScoringRules } from '@trade-ai/scoring-rules';
import type { DiagnosisIssue, PlatformPageData } from '@trade-ai/shared-types';

/** MIC-specific wrapper around shared scoring rules. Future MIC SEO rules live here. */
export function analyzeMicPage(page: PlatformPageData): DiagnosisIssue[] {
  if (page.platform !== 'MADE_IN_CHINA') {
    return runScoringRules(page);
  }
  return runScoringRules(page);
}

export function listMicRules() {
  return listScoringRules();
}
