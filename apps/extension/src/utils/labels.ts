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
  if (pageType === 'MIC_PRODUCT_EDIT') return 'MIC后台 · 产品编辑';
  if (pageType === 'MIC_PRODUCT_LIST') return 'MIC后台 · 产品列表';
  if (pageType === 'MIC_INQUIRY_LIST') return 'MIC后台 · 询盘列表';
  if (pageType === 'MIC_INQUIRY_DETAIL') return 'MIC后台 · 询盘详情';
  if (pageType === 'MIC_VIRTUAL_OFFICE') return 'MIC后台';
  return '未识别';
}

export function severityLabel(severity: IssueSeverity): string {
  if (severity === 'CRITICAL') return '严重';
  if (severity === 'HIGH') return '重要';
  if (severity === 'MEDIUM' || severity === 'LOW') return '建议';
  return severity;
}

export function categoryVerdictLabel(verdict: string): string {
  if (verdict === 'MATCH') return '匹配';
  if (verdict === 'POSSIBLE_MISMATCH') return '可能不匹配';
  if (verdict === 'MISMATCH') return '不匹配';
  if (verdict === 'UNCERTAIN') return '不确定';
  return verdict;
}
