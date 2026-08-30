import type { PlatformPageData } from '@trade-ai/shared-types';

export type RuntimeMessage =
  | { type: 'GET_PAGE_DATA' }
  | { type: 'PAGE_DATA'; payload: PlatformPageData }
  | { type: 'CAPTURE_ERROR'; message: string };

export async function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

export async function requestPageData(tabId: number): Promise<PlatformPageData> {
  const response = (await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_DATA' })) as
    | { ok: true; data: PlatformPageData }
    | { ok: false; message: string };
  if (!response?.ok) {
    throw new Error(response?.message || 'CAPTURE_FAILED');
  }
  return response.data;
}
