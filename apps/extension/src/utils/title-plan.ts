import type { TitleOptimizePayload } from '@trade-ai/shared-types';
import { titleMatchesTrustedIdentity } from '@trade-ai/universal-product-intelligence';

export function titlePlanScore(title: string, trustedIdentity: string, warnings: string[]): number {
  let score = 40;
  if (titleMatchesTrustedIdentity(title, trustedIdentity)) score += 40;
  if (title.length >= 24 && title.length <= 120) score += 12;
  if (!warnings.some((w) => /GUARD|FactGuard/i.test(w))) score += 8;
  return Math.min(100, score);
}

export function titleRiskLabel(row: TitleOptimizePayload['recommendedTitles'][number], paused: boolean): string {
  if (paused) return '已暂停';
  if (row.warnings.some((w) => /IDENTITY/i.test(w))) return '身份风险';
  if (row.warnings.some((w) => /CLAIM|FactGuard/i.test(w))) return '声明已拦截';
  return '低';
}
