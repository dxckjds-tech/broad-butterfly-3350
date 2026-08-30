import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseVoProducts } from '../products/parse';

const dir = dirname(fileURLToPath(import.meta.url));
describe('mic-permissions', () => {
  it('NO_PERMISSION for denied submodule', () => {
    const doc = new JSDOM(readFileSync(join(dir, 'fixtures', 'no-permission.html'), 'utf8')).window.document;
    expect(parseVoProducts(doc, 'https://membercenter.made-in-china.com/').status).toBe('NO_PERMISSION');
  });
});
