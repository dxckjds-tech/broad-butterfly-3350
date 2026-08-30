import { describe, expect, it } from 'vitest';
import { emptyPageData } from '@trade-ai/shared-types';
import { evaluateDiagnosis, runScoringRules } from './index';

describe('backend edit keyword rules', () => {
  it('does not treat UNCERTAIN keyword parse as zero-keyword FAIL', () => {
    const page = emptyPageData({
      platform: 'MADE_IN_CHINA',
      pageType: 'MIC_PRODUCT_EDIT',
      productName: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
      keywords: [],
      fieldStatus: { keywords: 'UNCERTAIN', productName: 'FOUND' },
      parseQuality: { score: 80, foundFields: ['productName'], missingFields: [], warnings: [] },
    });
    const issue = runScoringRules(page).find((item) => item.id === 'google-keyword-count');
    expect(issue?.title).toContain('暂未可靠识别后台关键词');
    expect(issue?.scoreImpact).toBe(0);
  });

  it('only flags missing keywords when parse status is FOUND and length is 0', () => {
    const page = emptyPageData({
      platform: 'MADE_IN_CHINA',
      pageType: 'MIC_PRODUCT_EDIT',
      productName: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
      keywords: [],
      fieldStatus: { keywords: 'FOUND', productName: 'FOUND' },
      parseQuality: { score: 80, foundFields: ['productName', 'keywords'], missingFields: [], warnings: [] },
    });
    const issue = runScoringRules(page).find((item) => item.id === 'google-keyword-count');
    expect(issue?.title).toBe('关键词缺失');
  });

  it('passes when backend keywords are present', () => {
    const page = emptyPageData({
      platform: 'MADE_IN_CHINA',
      pageType: 'MIC_PRODUCT_EDIT',
      productName: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
      category: 'Steam Cleaner',
      keywords: [
        'Heavy Duty Cleaner',
        'Wet and Dry Cleaner',
        'Industrial Use Cleaner',
        'Powerful Industrial Vacuum Cleaner',
        'High Suction Vacuum Cleaner',
      ],
      primaryKeywords: ['Heavy Duty Cleaner', 'Wet and Dry Cleaner', 'Industrial Use Cleaner'],
      centerTerms: ['cleaner', 'suction'],
      fieldStatus: { keywords: 'FOUND', productName: 'FOUND', category: 'FOUND' },
      categoryRelevance: {
        status: 'POSSIBLE_MISMATCH',
        title: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
        category: 'Steam Cleaner',
        message: '当前产品名称与所选 MIC 子目录可能存在匹配度问题，建议人工确认类目。',
      },
      parseQuality: { score: 88, foundFields: ['productName', 'keywords', 'category'], missingFields: [], warnings: [] },
    });
    const diagnosis = evaluateDiagnosis(page);
    const keywordIssue = diagnosis.ruleResults?.find((item) => item.ruleId === 'google-keyword-count');
    expect(keywordIssue?.status).toBe('PASS');
    expect(keywordIssue?.description).not.toMatch(/可识别关键词 0/);
    const category = diagnosis.ruleResults?.find((item) => item.ruleId === 'mic-category-relevance');
    expect(category?.title).toMatch(/匹配度问题/);
  });
});
