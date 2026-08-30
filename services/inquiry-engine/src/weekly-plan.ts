import type { MICInquiryRecord, MICOpportunitySummary, MICProductRecord } from '@trade-ai/shared-types';
import { analyzeInquiry } from './analysis';

export function weeklyPlanWithInquirySignals(input: {
  lowGeoHighInquiry: MICProductRecord[];
  summary: MICOpportunitySummary;
  inquiries: MICInquiryRecord[];
}): { objective: string; summary: string; tasks: string[] } {
  const high = input.inquiries.filter((i) => analyzeInquiry(i).buyerIntent === 'HIGH').length;
  const geoTargets = input.lowGeoHighInquiry.slice(0, 5).map((p) => p.productName);
  const tasks = [
    input.summary.unrepliedInquiries
      ? `跟进 ${input.summary.unrepliedInquiries} 条待回复询盘（不自动发送）`
      : '检查是否有新询盘需人工回复',
    geoTargets.length
      ? `本周优先优化 ${geoTargets.length} 个已有询盘但 GEO 偏低的产品：${geoTargets.join('、')}`
      : '按 OpportunityScore 处理高潜产品（暂无询盘信号）',
    high ? `人工审核 ${high} 条高意向询盘并生成回复草稿` : '保持询盘监控',
  ];
  return {
    objective: 'Improve Conversion Readiness',
    summary: `结合询盘信号制定周计划：待回复 ${input.summary.unrepliedInquiries}，高意向 ${high}。AI 不修改底层 SEO 分数，也不自动联系买家。`,
    tasks,
  };
}
