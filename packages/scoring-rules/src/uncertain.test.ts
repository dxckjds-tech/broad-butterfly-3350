import { describe, expect, it } from 'vitest';
import { emptyPageData } from '@trade-ai/shared-types';
import { runScoringRules } from './index';

describe('uncertain scoring', () => {
  it('uses recognition wording when specifications are UNCERTAIN', () => {
    const page = emptyPageData({
      platform: 'MADE_IN_CHINA',
      pageType: 'PRODUCT',
      productName: 'Automatic Binding Machine',
      companyName: 'Demo Co., Ltd.',
      description: 'x'.repeat(320),
      images: ['a.jpg', 'b.jpg', 'c.jpg'],
      specifications: {},
      fieldStatus: { specifications: 'UNCERTAIN', productName: 'FOUND' },
      parseQuality: { score: 40, foundFields: ['productName'], missingFields: ['specifications'], warnings: [] },
    });
    const spec = runScoringRules(page).find((item) => item.id === 'content-specification-coverage');
    expect(spec?.title).toBe('规格参数暂未成功识别');
    expect(spec?.severity).toBe('LOW');
  });

  it('uses missing wording when confidence is high and specs are absent', () => {
    const page = emptyPageData({
      platform: 'MADE_IN_CHINA',
      pageType: 'PRODUCT',
      productName: 'Automatic Binding Machine Extra Long Title',
      companyName: 'Demo Co., Ltd.',
      description: 'x'.repeat(320),
      images: ['a.jpg', 'b.jpg', 'c.jpg'],
      specifications: {},
      keywords: ['a', 'b', 'c'],
      fieldStatus: { specifications: 'MISSING', productName: 'FOUND', companyName: 'FOUND' },
      parseQuality: { score: 80, foundFields: ['productName'], missingFields: ['specifications'], warnings: [] },
    });
    const spec = runScoringRules(page).find((item) => item.id === 'content-specification-coverage');
    expect(spec?.title).toBe('产品参数信息不足');
    expect(spec?.severity).toBe('HIGH');
  });
});
