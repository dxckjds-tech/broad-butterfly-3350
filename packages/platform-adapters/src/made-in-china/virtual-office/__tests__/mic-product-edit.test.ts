import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { detectMicPageType } from '../../detector';
import { parseMadeInChinaPage } from '../../parser';
import { extractKeywords } from '../../extract';

const dir = dirname(fileURLToPath(import.meta.url));
const url = 'https://membercenter.made-in-china.com/prodManage/editProduct?prodId=DEMO';

function load() {
  const html = readFileSync(join(dir, 'fixtures', 'mic-product-edit-realistic.html'), 'utf8');
  return new JSDOM(html).window.document;
}

describe('MIC product edit realistic fixture', () => {
  const doc = load();
  const page = parseMadeInChinaPage(doc, url);

  it('detects MIC_PRODUCT_EDIT instead of UNKNOWN', () => {
    expect(detectMicPageType(doc, url)).toBe('MIC_PRODUCT_EDIT');
    expect(page.pageType).toBe('MIC_PRODUCT_EDIT');
    expect(page.pageTypeConfidence ?? 0).toBeGreaterThanOrEqual(0.45);
    expect(page.diagnosisMode).toBe('BACKEND_EDIT');
    expect(page.adapterVersion).toBe('MIC_ADAPTER_3.0.0');
  });

  it('reads form values for title, category, keywords, center terms', () => {
    expect(page.fieldStatus?.productName).toBe('FOUND');
    expect(page.productName).toBe('High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use');
    expect(page.fieldStatus?.category).toBe('FOUND');
    expect(page.category).toBe('Steam Cleaner');
    expect(page.categorySource).toBe('BACKEND_SELECTED_CATEGORY');
    expect(page.fieldStatus?.keywords).toBe('FOUND');
    expect(page.keywords.length).toBeGreaterThan(0);
    expect(page.keywords).toEqual(
      expect.arrayContaining([
        'Steam Cleaner',
        'Wet and Dry Vacuum Cleaner',
        'Hospital Vacuum Cleaner',
        'Eco-Friendly Vacuum Cleaner',
        'Heavy Duty Cleaner',
        'Wet and Dry Cleaner',
        'Industrial Use Cleaner',
        'Powerful Industrial Vacuum Cleaner',
        'High Suction Vacuum Cleaner',
      ]),
    );
    expect(page.centerTerms.map((t) => t.toLowerCase())).toEqual(expect.arrayContaining(['cleaner', 'suction']));
    expect(page.centerTermCount).toBeGreaterThan(0);
    expect(page.primaryKeywords).toEqual(page.keywords.slice(0, 3));
  });

  it('does not treat the old innerText/meta keyword path as the source of truth', () => {
    const legacyKeywords = extractKeywords(doc, []);
    expect(legacyKeywords.length).toBe(0);
    expect(page.keywords.length).toBeGreaterThanOrEqual(5);
  });

  it('parses specifications with ignore reasons and filters UI images', () => {
    expect(page.specifications.Power).toBe('3000W');
    expect(page.specifications.Suction).toBe('High Suction');
    expect(page.specDebug?.rawSpecificationCount).toBeGreaterThanOrEqual(7);
    expect(page.specDebug?.meaningfulSpecificationCount).toBeGreaterThanOrEqual(5);
    expect(page.specDebug?.ignoredSpecifications.some((i) => i.field === 'Model NO.' && i.reason === 'metadata_only')).toBe(
      true,
    );
    expect(page.images.length).toBe(2);
    expect(page.images.some((src) => /logo|star|ai-mike/i.test(src))).toBe(false);
  });

  it('marks collapsed trade/OEM as UNCERTAIN rather than MISSING', () => {
    expect(page.fieldStatus?.moq).toBe('UNCERTAIN');
    expect(page.fieldStatus?.oemAvailable).toBe('UNCERTAIN');
    expect(page.sectionAvailability?.TRADE_INFO).toBe('NOT_LOADED');
    expect(page.sectionAvailability?.OEM).toBe('NOT_LOADED');
    expect(JSON.stringify(page)).not.toContain('SHOULD_NOT_READ');
  });

  it('does not emit the keyword-count-zero false positive from parse status', () => {
    expect(page.fieldStatus?.keywords).toBe('FOUND');
    expect(page.keywordCount).toBe(page.keywords.length);
    expect(page.keywords.length).toBeGreaterThanOrEqual(5);
    expect(page.categoryRelevance?.status).toBe('POSSIBLE_MISMATCH');
  });
});
