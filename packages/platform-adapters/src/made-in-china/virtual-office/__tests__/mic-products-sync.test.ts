import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseVoProducts, mapProductStatus, productKey, assembleVirtualOfficeData } from '../index';

const dir = dirname(fileURLToPath(import.meta.url));
function load(name: string) {
  return new JSDOM(readFileSync(join(dir, 'fixtures', name), 'utf8')).window.document;
}

describe('mic-products-sync', () => {
  it('parses VO product list with verified source', () => {
    const { status, records } = parseVoProducts(load('products.html'), 'https://membercenter.made-in-china.com/member/main/');
    expect(status).toBe('SUCCESS');
    expect(records).toHaveLength(3);
    expect(records[0]?.micProductId).toBe('P1001');
    expect(records[0]?.isFeaturedProduct).toBe(true);
    expect(records[0]?.source).toBe('MIC_VIRTUAL_OFFICE');
    expect(records[0]?.evidenceLevel).toBe('VERIFIED');
  });
});

describe('mic-product-status', () => {
  it('maps official labels', () => {
    expect(mapProductStatus('展示中')).toBe('ONLINE');
    expect(mapProductStatus('待审核')).toBe('PENDING_REVIEW');
    expect(mapProductStatus('待修改')).toBe('NEEDS_MODIFICATION');
    expect(mapProductStatus('已下架')).toBe('OFFLINE');
    expect(mapProductStatus('草稿')).toBe('DRAFT');
    expect(mapProductStatus('')).toBe('UNKNOWN');
  });
});

describe('mic-product-dedup', () => {
  it('prefers micProductId then url+name hash', () => {
    expect(productKey('P1001', 'https://x/a', 'Handle').key).toBe('P1001');
    const a = productKey('', 'https://x/a', 'Window Handle');
    const b = productKey('', 'https://x/a', 'window   handle');
    expect(a.key).toBe(b.key);
    expect(a.idConfidence).toBeLessThan(0.9);
  });
});

describe('mic-permissions', () => {
  it('returns NO_PERMISSION without throwing', () => {
    const { status, records } = parseVoProducts(load('no-permission.html'), 'https://membercenter.made-in-china.com/');
    expect(status).toBe('NO_PERMISSION');
    expect(records).toEqual([]);
  });
});

describe('assemble', () => {
  it('builds virtual office payload from fixtures', () => {
    const data = assembleVirtualOfficeData({
      accountDoc: load('products.html'),
      productsDoc: load('products.html'),
      inquiriesDoc: load('inquiries.html'),
      sourcingDoc: load('sourcing.html'),
      source: 'FIXTURE',
    });
    expect(data.account.accountType).toBe('MAIN_ACCOUNT');
    expect(data.products.length).toBe(3);
    expect(data.inquiries.length).toBe(2);
    expect(data.sourcingRequests.length).toBe(1);
  });
});
