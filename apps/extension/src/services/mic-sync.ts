import { assembleVirtualOfficeData, MIC_VO_URLS } from '@trade-ai/platform-adapters';
import type { MICVirtualOfficeData } from '@trade-ai/shared-types';
import { API_BASE_URL } from '../utils/config';

export async function postMicSync(payload: MICVirtualOfficeData) {
  const res = await fetch(`${API_BASE_URL}/integrations/mic/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { success: boolean; data: unknown; message?: string };
  if (!json.success) throw new Error(json.message || 'sync failed');
  return json.data;
}

export function parseCurrentVoDocument(doc: Document, url: string): MICVirtualOfficeData {
  const module = doc.querySelector('[data-mic-module]')?.getAttribute('data-mic-module');
  return assembleVirtualOfficeData({
    accountDoc: doc,
    productsDoc: module === 'products' || doc.querySelector('[data-mic-product]') ? doc : undefined,
    inquiriesDoc: module === 'inquiries' || doc.querySelector('[data-mic-inquiry]') ? doc : undefined,
    sourcingDoc: module === 'sourcing' || doc.querySelector('[data-mic-sourcing]') ? doc : undefined,
    productsUrl: url,
    inquiriesUrl: url,
    sourcingUrl: url,
    accountUrl: url,
    source: 'MIC_VIRTUAL_OFFICE',
    mode: 'MANUAL',
  });
}

export { MIC_VO_URLS, assembleVirtualOfficeData };
