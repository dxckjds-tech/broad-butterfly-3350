import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseMadeInChinaPage } from '../parser';

const dir = dirname(fileURLToPath(import.meta.url));

describe('product-short-title', () => {
  it('cleans document.title noise and keeps short h1', () => {
    const html = readFileSync(join(dir, 'fixtures', 'product-short-title.html'), 'utf8');
    const doc = new JSDOM(html).window.document;
    const page = parseMadeInChinaPage(doc, 'https://x.en.made-in-china.com/product/1/Handle.html');
    expect(page.productName).toBe('Handle');
    expect(page.productName).not.toMatch(/Made-in-China/i);
    expect(page.parseQuality).toBeDefined();
  });
});
