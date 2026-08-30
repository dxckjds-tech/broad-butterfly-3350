import type { MICInquiryRecord } from '@trade-ai/shared-types';
import { recordHash, stableHash } from '../shared/hash';
import { detectModuleAccess } from '../shared/permission';

function cell(row: Element, name: string): string {
  return (
    row.getAttribute(`data-${name}`) ||
    row.querySelector(`[data-field="${name}"]`)?.textContent ||
    ''
  ).trim();
}

function preview(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.slice(0, 180);
}

export function parseVoInquiries(doc: Document, url: string, syncedAt = new Date().toISOString()): {
  status: ReturnType<typeof detectModuleAccess>;
  records: MICInquiryRecord[];
} {
  const access = detectModuleAccess(doc, url);
  if (access === 'NO_PERMISSION') return { status: access, records: [] };

  const rows = [
    ...doc.querySelectorAll('[data-mic-inquiry], tr[data-inquiry-id], [data-mic-module="inquiries"] tbody tr'),
  ];
  const records: MICInquiryRecord[] = [];
  for (const row of rows) {
    const subject = cell(row, 'subject') || row.querySelector('.subject, td')?.textContent?.trim() || '';
    if (!subject || /subject|主题/i.test(subject) && subject.length < 8) continue;
    const rawId = cell(row, 'inquiry-id') || row.getAttribute('data-inquiry-id') || '';
    const micInquiryId = rawId || `prov:${stableHash(subject + cell(row, 'received'))}`;
    records.push({
      micInquiryId,
      subject,
      buyerName: cell(row, 'buyer') || 'UNKNOWN',
      buyerCompany: cell(row, 'company') || 'UNKNOWN',
      buyerCountry: cell(row, 'country') || 'UNKNOWN',
      productId: cell(row, 'product-id'),
      productName: cell(row, 'product'),
      receivedAt: cell(row, 'received') || null,
      status: cell(row, 'status') || 'UNKNOWN',
      assignedAccount: cell(row, 'assignee') || 'UNKNOWN',
      messagePreview: preview(cell(row, 'preview') || subject),
      lastReplyAt: cell(row, 'replied') || null,
      syncedAt,
      idConfidence: rawId ? 0.95 : 0.5,
      source: 'MIC_VIRTUAL_OFFICE',
      evidenceLevel: 'VERIFIED',
    });
  }
  void recordHash;
  return { status: records.length ? 'SUCCESS' : access === 'SUCCESS' ? 'PARSE_FAILED' : access, records };
}

export function parseVoInquiryDetail(doc: Document, url: string, syncedAt = new Date().toISOString()): MICInquiryRecord | null {
  const access = detectModuleAccess(doc, url);
  if (access === 'NO_PERMISSION') return null;
  const root = doc.querySelector('[data-mic-inquiry-detail]') ?? doc.body;
  if (!root) return null;
  const subject = (root.querySelector('[data-field="subject"]')?.textContent || doc.title || '').trim();
  if (!subject) return null;
  const body = (root.querySelector('[data-field="body"]')?.textContent || '').trim();
  return {
    micInquiryId: root.getAttribute('data-inquiry-id') || `prov:${stableHash(subject)}`,
    subject,
    buyerName: (root.querySelector('[data-field="buyer"]')?.textContent || 'UNKNOWN').trim(),
    buyerCompany: (root.querySelector('[data-field="company"]')?.textContent || 'UNKNOWN').trim(),
    buyerCountry: (root.querySelector('[data-field="country"]')?.textContent || 'UNKNOWN').trim(),
    productId: (root.querySelector('[data-field="product-id"]')?.textContent || '').trim(),
    productName: (root.querySelector('[data-field="product"]')?.textContent || '').trim(),
    receivedAt: (root.querySelector('[data-field="received"]')?.textContent || '').trim() || null,
    status: (root.querySelector('[data-field="status"]')?.textContent || 'UNKNOWN').trim(),
    assignedAccount: 'UNKNOWN',
    messagePreview: preview(body || subject),
    lastReplyAt: null,
    syncedAt,
    idConfidence: 0.9,
    source: 'MIC_VIRTUAL_OFFICE',
    evidenceLevel: 'VERIFIED',
  };
}
