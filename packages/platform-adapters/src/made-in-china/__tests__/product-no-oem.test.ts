import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseMadeInChinaPage } from '../parser';

const dir = dirname(fileURLToPath(import.meta.url));

describe('product-no-oem', () => {
  it('does not mark OEM true from a generic product name', () => {
    const html = readFileSync(join(dir, 'fixtures', 'product-no-oem.html'), 'utf8');
    const doc = new JSDOM(html).window.document;
    const page = parseMadeInChinaPage(
      doc,
      'https://steel.en.made-in-china.com/product/x/Galvanized-Steel-Pipe.html',
    );
    expect(page.oemAvailable).toBe(false);
    expect(page.moq).toMatch(/10/i);
    expect(page.productName).toMatch(/Steel Pipe/i);
    expect(page.images.length).toBe(3);
  });
});
