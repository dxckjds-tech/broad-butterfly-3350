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

  it('reads live MIC counters and visible-text fallbacks without inventing company or description data', () => {
    const live = new JSDOM(`<!doctype html><html><head><title>修改产品</title></head><body>
      <h1>修改产品</h1><form>
        <div>已选子目录： Steam Cleaner 产品名称</div>
        <label>产品名称</label><input value="High Pressure Portable Steam Cleaner for Home and Car Cleaning">
        <div class="form-item"><label>关键词</label><input value="Portable Steam Cleaner"></div>
        <div class="form-item"><label>中心词</label><label><input type="checkbox" checked>cleaner</label></div>
        <div class="form-item"><label>产品属性</label></div>
        <div class="form-item"><label>功率</label><select><option selected>1500W-2000W</option></select></div>
        <div class="form-item"><label>容量</label><input value="2L"></div>
        <div class="upload-zone"><span>图片(5/6)</span></div>
        <section><h3>FOB价格设置</h3><div class="form-item"><label>最小起订量</label><input value="1000"></div></section>
        <div class="company-name">如何设置产品描述？</div>
        <div class="form-item"><label>产品描述</label><input type="checkbox" checked value="true"></div>
        <button>提交审核</button>
      </form></body></html>`).window.document;
    const parsed = parseMadeInChinaPage(live, url);

    expect(parsed.category).toBe('Steam Cleaner');
    expect(parsed.imageCount).toBe(5);
    expect(parsed.fieldStatus?.images).toBe('FOUND');
    expect(parsed.specifications['功率']).toBe('1500W-2000W');
    expect(parsed.specifications['容量']).toBe('2L');
    expect(parsed.moq).toBe('1000');
    expect(parsed.companyName).toBe('');
    expect(parsed.description).toBe('');
  });
});
