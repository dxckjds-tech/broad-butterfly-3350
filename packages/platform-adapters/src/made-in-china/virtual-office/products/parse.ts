import type { MICProductRecord, MICProductStatus } from '@trade-ai/shared-types';
import { productKey, recordHash } from '../shared/hash';
import { detectModuleAccess } from '../shared/permission';

const STATUS_MAP: Array<[RegExp, MICProductStatus]> = [
  [/待修改|need.?modif|reject|revision/i, 'NEEDS_MODIFICATION'],
  [/待审核|pending|audit|review/i, 'PENDING_REVIEW'],
  [/下架|offline|inactive/i, 'OFFLINE'],
  [/草稿|draft/i, 'DRAFT'],
  [/展示|online|showing|approved|published/i, 'ONLINE'],
];

export function mapProductStatus(raw: string): MICProductStatus {
  const text = raw.trim();
  if (!text) return 'UNKNOWN';
  for (const [re, status] of STATUS_MAP) {
    if (re.test(text)) return status;
  }
  return 'UNKNOWN';
}

function cell(row: Element, name: string): string {
  return (
    row.getAttribute(`data-${name}`) ||
    row.querySelector(`[data-field="${name}"]`)?.textContent ||
    ''
  ).trim();
}

export function parseVoProducts(doc: Document, url: string, syncedAt = new Date().toISOString()): {
  status: ReturnType<typeof detectModuleAccess>;
  records: MICProductRecord[];
} {
  const access = detectModuleAccess(doc, url);
  if (access === 'NO_PERMISSION') return { status: access, records: [] };

  const rows = [
    ...doc.querySelectorAll('[data-mic-product], tr[data-product-id], [data-mic-module="products"] tbody tr'),
  ];
  const records: MICProductRecord[] = [];
  for (const row of rows) {
    const name = cell(row, 'name') || row.querySelector('a, .name, td')?.textContent?.trim() || '';
    if (!name || name.toLowerCase() === 'product name') continue;
    const micId = cell(row, 'product-id') || row.getAttribute('data-product-id') || '';
    const productUrl = cell(row, 'url') || row.querySelector('a')?.getAttribute('href') || '';
    const { key, idConfidence } = productKey(micId, productUrl, name);
    const status = mapProductStatus(cell(row, 'status') || row.getAttribute('data-status') || '');
    const keywords = (cell(row, 'keywords') || '')
      .split(/[,;]/)
      .map((k) => k.trim())
      .filter(Boolean);
    const featured = /true|1|yes|主打/i.test(cell(row, 'featured') || row.getAttribute('data-featured') || '');
    const rec: MICProductRecord = {
      micProductId: key,
      productName: name,
      productUrl,
      model: cell(row, 'model'),
      category: cell(row, 'category'),
      status,
      keywords,
      attributes: {},
      tradeInfo: cell(row, 'trade'),
      isFeaturedProduct: featured,
      featuredScore: featured ? Number(cell(row, 'featured-score') || 0) || null : null,
      mainProductScore: featured ? Number(cell(row, 'featured-score') || 0) || null : null,
      updatedAtRemote: cell(row, 'updated') || null,
      syncedAt,
      rawSourceHash: '',
      idConfidence,
      source: 'MIC_VIRTUAL_OFFICE',
      evidenceLevel: 'VERIFIED',
    };
    rec.rawSourceHash = recordHash({
      name: rec.productName,
      status: rec.status,
      url: rec.productUrl,
      model: rec.model,
      keywords: rec.keywords,
    });
    records.push(rec);
  }

  const hasModule = Boolean(doc.querySelector('[data-mic-module="products"], [data-mic-product]'));
  return {
    status: records.length || hasModule ? 'SUCCESS' : 'PARSE_FAILED',
    records,
  };
}
