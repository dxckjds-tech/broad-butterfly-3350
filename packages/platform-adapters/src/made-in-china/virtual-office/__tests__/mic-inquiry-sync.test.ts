import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseVoInquiries, parseVoInquiryDetail, parseVoSourcing, assembleVirtualOfficeData, overallSyncStatus } from '../index';

const dir = dirname(fileURLToPath(import.meta.url));
function load(name: string) {
  return new JSDOM(readFileSync(join(dir, 'fixtures', name), 'utf8')).window.document;
}

describe('mic-inquiry-sync', () => {
  it('parses inquiry list as summaries only', () => {
    const { records } = parseVoInquiries(load('inquiries.html'), 'https://membercenter.made-in-china.com/');
    expect(records).toHaveLength(2);
    expect(records[0]?.micInquiryId).toBe('INQ2001');
    expect(records[0]?.messagePreview.length).toBeLessThanOrEqual(180);
    expect(JSON.stringify(records)).not.toMatch(/cookie|password|smsCode/i);
  });
});

describe('inquiry-detail', () => {
  it('reads structured detail fields', () => {
    const detail = parseVoInquiryDetail(load('inquiry-detail.html'), 'https://membercenter.made-in-china.com/');
    expect(detail?.productName).toContain('Window Handle');
    expect(detail?.buyerCompany).toBe('Nordic Doors AB');
  });
});

describe('mic-sourcing-sync', () => {
  it('parses RFQ rows', () => {
    const { status, records } = parseVoSourcing(load('sourcing.html'), 'https://membercenter.made-in-china.com/');
    expect(status).toBe('SUCCESS');
    expect(records[0]?.micRequestId).toBe('RFQ3001');
    expect(records[0]?.quantity).toBe('8000');
  });
});

describe('mic-partial-sync', () => {
  it('marks PARTIAL when sourcing has no permission but products succeed', () => {
    const data = assembleVirtualOfficeData({
      productsDoc: load('products.html'),
      inquiriesDoc: load('inquiries.html'),
      sourcingDoc: load('no-permission.html'),
    });
    expect(overallSyncStatus(data)).toBe('PARTIAL');
    const sourcing = data.syncMeta.modules.find((m) => m.module === 'SOURCING');
    expect(sourcing?.status).toBe('NO_PERMISSION');
  });
});
