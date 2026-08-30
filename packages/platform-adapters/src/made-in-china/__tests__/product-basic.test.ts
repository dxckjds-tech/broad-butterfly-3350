import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseMadeInChinaPage } from '../parser';
import { detectMicPageType } from '../detector';

const dir = dirname(fileURLToPath(import.meta.url));

function load(name: string) {
  const html = readFileSync(join(dir, 'fixtures', name), 'utf8');
  return new JSDOM(html).window.document;
}

describe('product-basic', () => {
  const url = 'https://zzzomagtc.en.made-in-china.com/product/abc/China-Binding-Machine.html';
  const doc = load('product-basic.html');
  const page = parseMadeInChinaPage(doc, url);

  it('detects PRODUCT', () => {
    expect(detectMicPageType(doc, url)).toBe('PRODUCT');
    expect(page.pageType).toBe('PRODUCT');
  });

  it('extracts core fields', () => {
    expect(page.productName).toBe('Automatic Spiral Wire Binding Machine');
    expect(page.companyName).toContain('Zomagtc');
    expect(page.images.length).toBe(3);
    expect(page.images.some((src) => /logo|icon/i.test(src))).toBe(false);
    expect(page.specifications['Model NO.']).toBe('ZM-500');
    expect(page.moq.toLowerCase()).toContain('1 piece');
    expect(page.deliveryTime.toLowerCase()).toContain('15');
    expect(page.oemAvailable).toBe(true);
    expect(page.certifications).toContain('CE');
    expect(page.description.toLowerCase()).toContain('spiral wire');
    expect(page.description).not.toMatch(/Copyright Made-in-China/i);
    expect(page.parseQuality?.score ?? 0).toBeGreaterThan(70);
  });
});
