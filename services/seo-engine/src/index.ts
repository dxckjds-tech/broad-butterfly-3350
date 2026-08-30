import type { PlatformPageData } from '@trade-ai/shared-types';

export interface SeoSignal {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface SeoAnalysisResult {
  google: SeoSignal[];
  bing: SeoSignal[];
  meta: {
    title: string;
    description: string;
  };
  searchIntent: string;
  semanticStructure: string;
  indexability: string;
  contentUniqueness: string;
  entityClarity: string;
}

export interface SeoAnalyzer {
  analyze(pageData: PlatformPageData): Promise<SeoAnalysisResult>;
}

export class RuleSeoAnalyzer implements SeoAnalyzer {
  async analyze(pageData: PlatformPageData): Promise<SeoAnalysisResult> {
    const title = pageData.title || pageData.productName;
    return {
      google: [
        {
          id: 'title',
          label: 'Title',
          passed: title.length >= 8,
          detail: title || 'missing',
        },
      ],
      bing: [],
      meta: {
        title,
        description: pageData.description.slice(0, 160),
      },
      searchIntent: 'informational-commercial',
      semanticStructure: Object.keys(pageData.specifications).length > 0 ? 'has-specs' : 'weak',
      indexability: 'unknown',
      contentUniqueness: 'not-evaluated',
      entityClarity: pageData.companyName ? 'company-present' : 'company-missing',
    };
  }
}

export const seoAnalyzer: SeoAnalyzer = new RuleSeoAnalyzer();
