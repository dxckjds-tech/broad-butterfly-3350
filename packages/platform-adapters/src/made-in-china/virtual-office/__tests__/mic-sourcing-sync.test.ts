import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseVoSourcing } from '../sourcing/parse';

const dir = dirname(fileURLToPath(import.meta.url));
describe('mic-sourcing-sync', () => {
  it('reads RFQ fixture', () => {
    const doc = new JSDOM(readFileSync(join(dir, 'fixtures', 'sourcing.html'), 'utf8')).window.document;
    expect(parseVoSourcing(doc, 'https://membercenter.made-in-china.com/').records[0]?.title).toMatch(/Window handle/i);
  });
});
