import type { MICSourcingRequest } from '@trade-ai/shared-types';
import { stableHash } from '../shared/hash';
import { detectModuleAccess } from '../shared/permission';

function cell(row: Element, name: string): string {
  return (
    row.getAttribute(`data-${name}`) ||
    row.querySelector(`[data-field="${name}"]`)?.textContent ||
    ''
  ).trim();
}

export function parseVoSourcing(doc: Document, url: string, syncedAt = new Date().toISOString()): {
  status: ReturnType<typeof detectModuleAccess>;
  records: MICSourcingRequest[];
} {
  const access = detectModuleAccess(doc, url);
  if (access === 'NO_PERMISSION') return { status: access, records: [] };

  const rows = [
    ...doc.querySelectorAll('[data-mic-sourcing], tr[data-request-id], [data-mic-module="sourcing"] tbody tr'),
  ];
  const records: MICSourcingRequest[] = [];
  for (const row of rows) {
    const title = cell(row, 'title') || row.querySelector('td, a')?.textContent?.trim() || '';
    if (!title || /title|采购需求/i.test(title) && title.length < 6) continue;
    const rawId = cell(row, 'request-id') || row.getAttribute('data-request-id') || '';
    records.push({
      micRequestId: rawId || `prov:${stableHash(title)}`,
      title,
      category: cell(row, 'category'),
      country: cell(row, 'country'),
      quantity: cell(row, 'quantity'),
      unit: cell(row, 'unit'),
      publishedAt: cell(row, 'published') || null,
      deadline: cell(row, 'deadline') || null,
      status: cell(row, 'status') || 'UNKNOWN',
      matchingProducts: [],
      syncedAt,
      idConfidence: rawId ? 0.9 : 0.5,
      source: 'MIC_VIRTUAL_OFFICE',
      evidenceLevel: 'VERIFIED',
    });
  }
  return { status: records.length ? 'SUCCESS' : access === 'SUCCESS' ? 'PARSE_FAILED' : access, records };
}
