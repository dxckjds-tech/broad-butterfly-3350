import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { assembleVirtualOfficeData, overallSyncStatus } from '../index';

const dir = dirname(fileURLToPath(import.meta.url));
const load = (n: string) => new JSDOM(readFileSync(join(dir, 'fixtures', n), 'utf8')).window.document;

describe('mic-partial-sync', () => {
  it('does not fail the whole job', () => {
    const data = assembleVirtualOfficeData({
      productsDoc: load('products.html'),
      sourcingDoc: load('no-permission.html'),
    });
    expect(overallSyncStatus(data)).toBe('PARTIAL');
  });
});
