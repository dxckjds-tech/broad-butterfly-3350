import { assembleVirtualOfficeData, MIC_VO_URLS } from '@trade-ai/platform-adapters';
import type { MICVirtualOfficeData } from '@trade-ai/shared-types';
import { getApiBaseUrl } from '../utils/config';

export async function previewMicSync(payload: MICVirtualOfficeData) {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/integrations/mic/sync/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { success: boolean; data: unknown; message?: string };
  if (!json.success) throw new Error(json.message || 'preview failed');
  return json.data;
}

export async function postMicSync(payload: MICVirtualOfficeData, confirmed = false) {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/integrations/mic/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, confirmed, actor: 'extension' }),
  });
  const json = (await res.json()) as { success: boolean; data: unknown; message?: string };
  if (!json.success) throw new Error(json.message || '真实数据同步失败');
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
