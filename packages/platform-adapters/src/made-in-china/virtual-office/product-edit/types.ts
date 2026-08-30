import type {
  CategoryRelevanceAnalysis,
  DataReadiness,
  FieldEvidenceSource,
  FieldStatusMap,
  SectionLoadState,
  SpecParseDebug,
} from '@trade-ai/shared-types';

export const MIC_ADAPTER_VERSION = 'MIC_ADAPTER_3.0.0';

export const PRODUCT_EDIT_LABELS = {
  productName: [/产品名称/, /product\s*name/i],
  keywords: [/关键词/, /\bkeywords?\b/i],
  centerTerms: [/中心词/, /center\s*words?/, /core\s*words?/i],
  category: [/已选子目录/, /已选类目/, /selected\s*(sub[- ]?)?categor/i],
  basicInfo: [/基本信息/, /basic\s*info/i],
  submitReview: [/提交审核/, /submit\s*(for\s*)?review/i],
  editProduct: [/修改产品/, /edit\s*product/, /product\s*edit/i],
  specifications: [/规格参数/, /产品属性/, /specifications?/, /product\s*attributes?/i],
  images: [/产品图片/, /图片管理/, /photo/, /image\s*upload/i],
  trade: [/贸易信息/, /trade\s*information/, /minimum\s*order/, /\bmoq\b/i],
  oem: [/\boem\b/i, /\bodm\b/i, /定制/, /customization/i],
  moq: [/最小起订/, /起订量/, /minimum\s*order/, /\bmoq\b/i],
  delivery: [/交货期/, /交期/, /lead\s*time/, /delivery\s*time/, /production\s*time/i],
} as const;

export interface ProductEditParse {
  productName: string;
  companyName: string;
  category: string;
  categorySource: string;
  keywords: string[];
  primaryKeywords: string[];
  centerTerms: string[];
  specifications: Record<string, string>;
  specDebug: SpecParseDebug;
  images: string[];
  moq: string;
  deliveryTime: string;
  oemAvailable: boolean;
  oemKnown: boolean;
  description: string;
  fieldStatus: FieldStatusMap;
  fieldEvidence: Record<string, FieldEvidenceSource>;
  sectionAvailability: Record<string, SectionLoadState>;
  matchedSelectors: Record<string, string>;
  categoryRelevance: CategoryRelevanceAnalysis;
  dataReadiness: DataReadiness;
  warnings: string[];
  pageTypeConfidence: number;
}
