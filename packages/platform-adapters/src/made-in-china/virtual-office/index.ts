export { MIC_VO_URLS, MIC_INTEGRATION_VERSION } from './urls';
export { parseMicProductEditPage } from './product-edit/parser';
export { detectProductEditConfidence, detectVirtualOfficePageType, isMicProductEditPage } from './product-edit/detector';
export { MIC_ADAPTER_VERSION } from './product-edit/types';
export { parseVoProducts, mapProductStatus } from './products/parse';
export { parseVoInquiries, parseVoInquiryDetail } from './inquiries/parse';
export { parseVoSourcing } from './sourcing/parse';
export { parseVoAccount } from './account/parse';
export { buildOpportunitySummary } from './opportunities/summary';
export { detectModuleAccess } from './shared/permission';
export { productKey, recordHash, stableHash, redactSecrets, assertNoSecrets } from './shared/hash';

import type { MICSyncMode, MICVirtualOfficeData } from '@trade-ai/shared-types';
import { parseVoAccount } from './account/parse';
import { parseVoInquiries } from './inquiries/parse';
import { buildOpportunitySummary } from './opportunities/summary';
import { parseVoProducts } from './products/parse';
import { parseVoSourcing } from './sourcing/parse';
import { redactSecrets } from './shared/hash';

export function parseEmbeddedVoJson(doc: Document): unknown | null {
  const node = doc.querySelector('script[type="application/json"][data-mic-module]');
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent);
  } catch {
    return null;
  }
}

export function assembleVirtualOfficeData(input: {
  accountDoc?: Document;
  productsDoc?: Document;
  inquiriesDoc?: Document;
  sourcingDoc?: Document;
  productsUrl?: string;
  inquiriesUrl?: string;
  sourcingUrl?: string;
  accountUrl?: string;
  mode?: MICSyncMode;
  source?: 'MIC_VIRTUAL_OFFICE' | 'FIXTURE';
}): MICVirtualOfficeData {
  const syncedAt = new Date().toISOString();
  const products = input.productsDoc
    ? parseVoProducts(input.productsDoc, input.productsUrl || '', syncedAt)
    : { status: 'SKIPPED' as const, records: [] };
  const inquiries = input.inquiriesDoc
    ? parseVoInquiries(input.inquiriesDoc, input.inquiriesUrl || '', syncedAt)
    : { status: 'SKIPPED' as const, records: [] };
  const sourcing = input.sourcingDoc
    ? parseVoSourcing(input.sourcingDoc, input.sourcingUrl || '', syncedAt)
    : { status: 'SKIPPED' as const, records: [] };
  const account = input.accountDoc
    ? parseVoAccount(input.accountDoc, input.accountUrl || '', syncedAt)
    : {
        accountLabel: 'MIC 账号',
        accountType: 'UNKNOWN' as const,
        permissions: ['UNKNOWN' as const],
        lastLoginDetectedAt: syncedAt,
      };

  const data: MICVirtualOfficeData = {
    account,
    products: products.records,
    inquiries: inquiries.records,
    opportunities: buildOpportunitySummary(inquiries.records),
    sourcingRequests: sourcing.records,
    syncMeta: {
      mode: input.mode ?? 'MANUAL',
      modules: [
        { module: 'PRODUCT_MANAGEMENT', status: products.status, records: products.records },
        { module: 'INQUIRIES', status: inquiries.status, records: inquiries.records },
        { module: 'SOURCING', status: sourcing.status, records: sourcing.records },
      ],
      startedAt: syncedAt,
      source: input.source ?? 'MIC_VIRTUAL_OFFICE',
    },
  };
  return redactSecrets(data);
}

export function overallSyncStatus(data: MICVirtualOfficeData): 'COMPLETED' | 'PARTIAL' | 'FAILED' {
  const mods = data.syncMeta.modules.filter((m) => m.status !== 'SKIPPED');
  if (!mods.length) return 'FAILED';
  const ok = mods.filter((m) => m.status === 'SUCCESS').length;
  const denied = mods.filter((m) => m.status === 'NO_PERMISSION' || m.status === 'PARSE_FAILED').length;
  if (ok && denied) return 'PARTIAL';
  if (ok) return 'COMPLETED';
  return 'FAILED';
}
