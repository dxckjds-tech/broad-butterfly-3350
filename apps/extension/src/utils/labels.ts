import type { IssueSeverity, PageType } from '@trade-ai/shared-types';

export function platformLabel(platform: string): string {
  if (platform === 'MADE_IN_CHINA') return 'Made-in-China.com';
  if (platform === 'ALIBABA') return 'Alibaba.com';
  if (platform === 'INDEPENDENT_SITE') return '独立站';
  return '未识别';
}

export function pageTypeLabel(pageType: PageType | string): string {
  if (pageType === 'PRODUCT') return '产品页';
  if (pageType === 'SHOP') return '店铺页';
  return '未识别';
}

export function severityLabel(severity: IssueSeverity): string {
  if (severity === 'CRITICAL') return '严重';
  if (severity === 'HIGH') return '重要';
  if (severity === 'MEDIUM' || severity === 'LOW') return '建议';
  return severity;
}
