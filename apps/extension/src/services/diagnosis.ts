import { diagnosePage as diagnoseLocally } from '@trade-ai/diagnosis-engine';
import type { DiagnosisResult, PlatformPageData } from '@trade-ai/shared-types';

export const EXTENSION_VERSION = '0.6.5';

export async function diagnosePage(page: PlatformPageData): Promise<DiagnosisResult> {
  const output = await diagnoseLocally(page);
  return {
    diagnosisId: 'local',
    totalScore: output.result.totalScore,
    scores: output.result.scores,
    issues: output.result.issues,
  };
}
