import type { IssueCategory, IssuePriority, RuleRegistryEntry } from '@trade-ai/shared-types';

export interface RegisteredRule extends RuleRegistryEntry {
  description: string;
}

const v = '1.0';

function r(
  id: string,
  name: string,
  category: IssueCategory,
  priority: IssuePriority,
  description: string,
): RegisteredRule {
  return { id, name, category, priority, enabled: true, version: v, description };
}

export const RULE_REGISTRY: RegisteredRule[] = [
  r('mic-title-exists', 'MIC Title Exists', 'MIC_SEO', 'P0', '产品标题是否存在'),
  r('mic-title-word-count', 'MIC Title Word Count', 'MIC_SEO', 'P1', '英文有效词数量启发式'),
  r('mic-title-core-term', 'MIC Title Core Term', 'MIC_SEO', 'P1', '标题中心词是否清晰'),
  r('mic-title-keyword-stuffing', 'MIC Title Keyword Stuffing', 'MIC_SEO', 'P1', '关键词/营销词堆砌'),
  r('mic-title-repetition', 'MIC Title Repetition', 'MIC_SEO', 'P2', '标题重复词'),
  r('mic-title-readability', 'MIC Title Readability', 'MIC_SEO', 'P3', '标题可读性'),
  r('mic-title-attribute-richness', 'MIC Title Attribute Richness', 'MIC_SEO', 'P2', '标题属性丰富度'),
  r('mic-title-brand-noise', 'MIC Title Brand Noise', 'MIC_SEO', 'P3', '品牌/Made in China 噪音'),
  r('mic-title-symbol-overuse', 'MIC Title Symbol Overuse', 'MIC_SEO', 'P3', '逗号斜杠堆叠'),
  r('content-description-exists', 'Description Exists', 'CONTENT', 'P0', '描述是否存在'),
  r('content-description-length', 'Description Length', 'CONTENT', 'P1', '描述有效词与结构'),
  r('content-specification-coverage', 'Specification Coverage', 'CONTENT', 'P1', '参数数量与有效性'),
  r('content-application-coverage', 'Application Coverage', 'CONTENT', 'P1', '应用场景'),
  r('content-feature-coverage', 'Feature Coverage', 'CONTENT', 'P2', '卖点/特性小节'),
  r('content-company-coverage', 'Company Coverage', 'CONTENT', 'P2', '企业能力证据'),
  r('content-oem-coverage', 'OEM Coverage', 'CONTENT', 'P2', '定制信息在内容中的覆盖'),
  r('content-certification-coverage', 'Certification Coverage', 'CONTENT', 'P2', '认证信息'),
  r('content-packaging-coverage', 'Packaging Coverage', 'CONTENT', 'P3', '包装说明'),
  r('content-delivery-coverage', 'Delivery Coverage', 'CONTENT', 'P2', '交期说明'),
  r('content-faq-coverage', 'FAQ Coverage', 'CONTENT', 'P3', 'FAQ 覆盖'),
  r('content-images', 'Product Images', 'CONTENT', 'P0', '去重后的图片数量'),
  r('content-marketing-fluff', 'Marketing Fluff', 'CONTENT', 'P2', '营销空话占比'),
  r('conversion-moq', 'MOQ Presence', 'CONVERSION', 'P2', '起订量（按产品类型加权）'),
  r('conversion-oem', 'OEM / ODM', 'CONVERSION', 'P2', 'OEM 相关性随类目变化'),
  r('conversion-application', 'Application for Buyers', 'CONVERSION', 'P1', '买家应用场景'),
  r('conversion-company', 'Company Proof', 'CONVERSION', 'P2', '公司实力证据分'),
  r('conversion-faq', 'FAQ for Conversion', 'CONVERSION', 'P3', 'FAQ，默认 LOW'),
  r('google-keyword-count', 'Keyword Coverage', 'GOOGLE_SEO', 'P2', '基础关键词覆盖'),
  r('mic-primary-keyword-1', 'Primary Keyword 1', 'MIC_SEO', 'P1', '后台 Keyword #1 与标题/中心词一致性'),
  r('mic-primary-keyword-2', 'Primary Keyword 2', 'MIC_SEO', 'P1', '后台 Keyword #2 与标题/中心词一致性'),
  r('mic-primary-keyword-3', 'Primary Keyword 3', 'MIC_SEO', 'P1', '后台 Keyword #3 与标题/中心词一致性'),
  r('mic-center-term-title', 'Center Terms vs Title', 'MIC_SEO', 'P1', '中心词是否出现在标题'),
  r('mic-category-relevance', 'Category Relevance', 'MIC_SEO', 'P1', '所选子目录与产品名称匹配度'),
  r('geo-application', 'GEO Application', 'GEO', 'P1', '实体/场景关联（浅规则）'),
  r('geo-faq', 'GEO FAQ', 'GEO', 'P3', 'FAQ 对 AI 可见性'),
  r('geo-company', 'GEO Company Entity', 'GEO', 'P2', '制造商实体'),
  r('geo-evidence', 'GEO Evidence Density', 'GEO', 'P2', '可验证事实密度'),
];

export const RULE_REGISTRY_MAP = new Map(RULE_REGISTRY.map((item) => [item.id, item]));
