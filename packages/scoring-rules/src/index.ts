import type { DiagnosisIssue, IssueCategory, IssueSeverity, PlatformPageData } from '@trade-ai/shared-types';
import { SEVERITY_PENALTY } from '@trade-ai/shared-types';

export interface ScoringRule {
  id: string;
  name: string;
  category: IssueCategory;
  severity: IssueSeverity;
  evaluate: (page: PlatformPageData) => boolean;
  title: string;
  description: string;
  suggestion: string;
}

const APPLICATION_HINTS = [
  'application',
  'applied',
  'used for',
  'use for',
  'scenario',
  '应用',
  '场景',
  '用于',
];

const FAQ_HINTS = ['faq', 'q&a', 'frequently asked', '常见问题', '问：', '答：'];

const CAPACITY_HINTS = ['production capacity', 'annual output', 'factory', '生产能力', '年产量', '厂房'];

function textBlob(page: PlatformPageData): string {
  return `${page.title} ${page.productName} ${page.description} ${page.rawText}`.toLowerCase();
}

function hasHint(page: PlatformPageData, hints: string[]): boolean {
  const blob = textBlob(page);
  return hints.some((hint) => blob.includes(hint.toLowerCase()));
}

function specCount(page: PlatformPageData): number {
  return Object.keys(page.specifications ?? {}).filter((key) => key.trim().length > 0).length;
}

export const scoringRules: ScoringRule[] = [
  {
    id: 'product-title-exists',
    name: 'Product title exists',
    category: 'MIC_SEO',
    severity: 'CRITICAL',
    evaluate: (page) => page.pageType !== 'PRODUCT' || page.productName.trim().length >= 8,
    title: '标题中心词不够明确',
    description: '产品标题缺失或过短，买家和搜索引擎难以识别核心产品词。',
    suggestion: '使用「材质 + 产品名 + 型号/用途」结构，例如 Aluminum Window Handle — Zinc Alloy, OEM。',
  },
  {
    id: 'description-exists',
    name: 'Description length',
    category: 'CONTENT',
    severity: 'HIGH',
    evaluate: (page) => page.description.trim().length >= 300,
    title: '产品描述过少',
    description: '产品描述不足 300 字符，内容深度不够，不利于 SEO 与询盘转化。',
    suggestion: '补充工艺、材料、公差、认证、包装与交货说明，使描述超过 300 字符。',
  },
  {
    id: 'has-images',
    name: 'Product images',
    category: 'CONTENT',
    severity: 'MEDIUM',
    evaluate: (page) => page.images.length >= 3,
    title: '图片数量较少',
    description: '当前页面可识别图片少于 3 张，展示力不足。',
    suggestion: '至少提供主图、细节图、场景图，建议 5 张以上高质量图片。',
  },
  {
    id: 'has-specifications',
    name: 'Specifications table',
    category: 'MIC_SEO',
    severity: 'HIGH',
    evaluate: (page) => page.pageType !== 'PRODUCT' || specCount(page) >= 3,
    title: '产品参数信息不足',
    description: '缺少结构化规格参数，MIC 搜索与筛选会受到影响。',
    suggestion: '补充材质、尺寸、表面处理、适用门窗类型等关键参数表。',
  },
  {
    id: 'has-oem',
    name: 'OEM / ODM information',
    category: 'CONVERSION',
    severity: 'HIGH',
    evaluate: (page) => page.oemAvailable || hasHint(page, ['oem', 'odm', 'custom', '定制']),
    title: '缺少 OEM / ODM 信息',
    description: '页面未明确 OEM / ODM 能力，B2B 买家难以判断合作方式。',
    suggestion: '在标题、属性或描述中明确 OEM/ODM、MOQ、打样周期。',
  },
  {
    id: 'has-moq',
    name: 'MOQ present',
    category: 'CONVERSION',
    severity: 'MEDIUM',
    evaluate: (page) => page.moq.trim().length > 0 || hasHint(page, ['moq', 'min. order', 'minimum order', '起订']),
    title: '缺少 MOQ 信息',
    description: '未展示最小起订量，询盘门槛不清晰。',
    suggestion: '明确 MOQ（例如 500 pcs）以及是否支持混批。',
  },
  {
    id: 'has-application',
    name: 'Application scenarios',
    category: 'GEO',
    severity: 'HIGH',
    evaluate: (page) => hasHint(page, APPLICATION_HINTS),
    title: '缺少应用场景描述',
    description: '没有说明产品用在何处，AI 与搜索引擎难以建立实体关联。',
    suggestion: '补充典型应用场景，例如 aluminum window, casement door, curtain wall。',
  },
  {
    id: 'has-faq',
    name: 'FAQ section',
    category: 'GEO',
    severity: 'LOW',
    evaluate: (page) => hasHint(page, FAQ_HINTS),
    title: '建议增加 FAQ',
    description: '页面缺少常见问答，不利于 GEO / AI Visibility。',
    suggestion: '增加 5–8 条买家高频问题：材料、认证、交期、样品、定制。',
  },
  {
    id: 'has-company-info',
    name: 'Company information',
    category: 'GEO',
    severity: 'HIGH',
    evaluate: (page) => page.companyName.trim().length > 0 || hasHint(page, CAPACITY_HINTS),
    title: '建议增加生产能力介绍',
    description: '公司主体或产能信息不足，制造商实体不够清晰。',
    suggestion: '补充公司名、工厂规模、年产能、主要出口市场。',
  },
  {
    id: 'keyword-count',
    name: 'Keyword coverage',
    category: 'GOOGLE_SEO',
    severity: 'MEDIUM',
    evaluate: (page) => page.keywords.filter((item) => item.trim().length > 0).length >= 3,
    title: '关键词覆盖不足',
    description: '可识别关键词少于 3 个，Google / 站内搜索匹配偏弱。',
    suggestion: '补充核心词、同义词与长尾词，例如 window handle, casement handle, aluminum hardware。',
  },
];

export function runScoringRules(page: PlatformPageData): DiagnosisIssue[] {
  const issues: DiagnosisIssue[] = [];

  for (const rule of scoringRules) {
    try {
      const passed = rule.evaluate(page);
      if (passed) continue;
      issues.push({
        id: rule.id,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        suggestion: rule.suggestion,
        scoreImpact: SEVERITY_PENALTY[rule.severity],
      });
    } catch {
      // A single rule failure must not break diagnosis.
    }
  }

  return issues;
}

export function listScoringRules(): Array<Omit<ScoringRule, 'evaluate'>> {
  return scoringRules.map(({ evaluate: _evaluate, ...rest }) => rest);
}
