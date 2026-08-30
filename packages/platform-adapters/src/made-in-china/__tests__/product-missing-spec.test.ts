import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseMadeInChinaPage } from '../parser';

const dir = dirname(fileURLToPath(import.meta.url));

describe('product-missing-spec', () => {
  it('parses title and company when specification table is absent', () => {
    const html = readFileSync(join(dir, 'fixtures', 'product-missing-spec.html'), 'utf8');
    const doc = new JSDOM(html).window.document;
    const page = parseMadeInChinaPage(
      doc,
      'https://demo.en.made-in-china.com/product/x/Aluminum-Window-Handle.html',
    );
    expect(page.productName).toBe('Aluminum Window Handle');
    expect(page.companyName).toContain('Foshan Hardware');
    expect(Object.keys(page.specifications).length).toBe(0);
    expect(page.fieldStatus?.specifications === 'MISSING' || page.fieldStatus?.specifications === 'UNCERTAIN').toBe(
      true,
    );
    expect(page.description.length).toBeGreaterThan(80);
  });
});
