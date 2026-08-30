import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { analyzeInquiry, draftInquiryReply } from './analysis';
import { businessPriorityScore } from './business-priority';
import { matchRfqToProducts, draftQuote } from './rfq-match';
import { applyIncrementalProducts, emptyCursor } from './sync';
import { assembleVirtualOfficeData, parseVoInquiries, parseVoProducts, parseVoSourcing } from '@trade-ai/platform-adapters';

const dir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(dir, '../../../packages/platform-adapters/src/made-in-china/virtual-office/__tests__/fixtures');
function load(name: string) {
  return new JSDOM(readFileSync(join(fixtureDir, name), 'utf8')).window.document;
}

describe('mic-inquiry-analysis', () => {
  it('scores OEM quantity inquiry higher than price-only', () => {
    const { records } = parseVoInquiries(load('inquiries.html'), 'https://example.test');
    const high = analyzeInquiry(records[0]!);
    const low = analyzeInquiry(records[1]!);
    expect(high.buyerIntent).toBe('HIGH');
    expect(high.evidenceLevel).toBe('INFERRED');
    expect(low.opportunityScore).toBeLessThan(high.opportunityScore);
    expect(low.riskSignals.length).toBeGreaterThan(0);
  });
});

describe('reply-draft', () => {
  it('does not invent price and sets autoSend false', () => {
    const { records } = parseVoInquiries(load('inquiries.html'), 'https://example.test');
    const draft = draftInquiryReply(records[1]!, analyzeInquiry(records[1]!));
    expect(draft.autoSend).toBe(false);
    expect(draft.english.toLowerCase()).not.toMatch(/\$\d|usd\s*\d/);
    expect(draft.factsToConfirm.length).toBeGreaterThan(0);
  });
});

describe('mic-opportunity-score', () => {
  it('does not give 95 to please-send-price', () => {
    const { records } = parseVoInquiries(load('inquiries.html'), 'https://example.test');
    expect(analyzeInquiry(records[1]!).opportunityScore).toBeLessThan(70);
  });
});

describe('rfq-match', () => {
  it('ranks window handle product for window handle RFQ', () => {
    const products = parseVoProducts(load('products.html'), 'https://example.test').records;
    const rfq = parseVoSourcing(load('sourcing.html'), 'https://example.test').records[0]!;
    const matches = matchRfqToProducts(rfq, products);
    expect(matches[0]?.productName).toMatch(/Window Handle/i);
    expect(matches[0]?.evidenceLevel).toBe('INFERRED');
    const quote = draftQuote(rfq, matches);
    expect(quote.priceStatus).toBe('PRICE_REQUIRED');
    expect(quote.autoSend).toBe(false);
  });
});

describe('mic-incremental-sync', () => {
  it('skips unchanged product hashes', () => {
    const data = assembleVirtualOfficeData({ productsDoc: load('products.html'), mode: 'INCREMENTAL' });
    const cursor = emptyCursor();
    cursor.productHashes[data.products[0]!.micProductId] = data.products[0]!.rawSourceHash;
    const result = applyIncrementalProducts(data, cursor);
    expect(result.unchanged).toBe(1);
    expect(result.changed.length).toBe(data.products.length - 1);
  });
});

describe('business-priority', () => {
  it('falls back to opportunity when no inquiries', () => {
    const products = parseVoProducts(load('products.html'), 'https://example.test').records;
    const none = businessPriorityScore({ opportunityScore: 88, inquiries: [], product: products[0]! });
    expect(none.usedInquirySignal).toBe(false);
    expect(none.score).toBe(88);
    const { records } = parseVoInquiries(load('inquiries.html'), 'https://example.test');
    const withInq = businessPriorityScore({ opportunityScore: 88, inquiries: records, product: products[0]! });
    expect(withInq.usedInquirySignal).toBe(true);
    expect(withInq.evidenceLevel).toBe('INFERRED');
  });
});
