import type { PlatformPageData } from '@trade-ai/shared-types';

export type RuntimeMessage =
  | { type: 'GET_PAGE_DATA' }
  | { type: 'PAGE_DATA'; payload: PlatformPageData }
  | { type: 'CAPTURE_ERROR'; message: string };

function isTargetUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    /made-in-china\.com/i.test(url) ||
    /:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/demo\//i.test(url)
  );
}

export async function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [lastFocused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (isTargetUrl(lastFocused?.url)) return lastFocused;

  const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isTargetUrl(current?.url)) return current;

  const candidates = await chrome.tabs.query({});
  const matched = candidates.filter((tab) => isTargetUrl(tab.url));
  return matched.find((tab) => tab.active) ?? matched[0] ?? lastFocused ?? current;
}

async function sendGetPageData(tabId: number): Promise<PlatformPageData> {
  const response = (await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_DATA' })) as
    | { ok: true; data: PlatformPageData }
    | { ok: false; message: string };
  if (!response?.ok) {
    throw new Error(response?.message || 'CAPTURE_FAILED');
  }
  return response.data;
}

async function injectContentScript(tabId: number): Promise<void> {
  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js;
  if (!files?.length || !chrome.scripting?.executeScript) {
    throw new Error('CAPTURE_FAILED');
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files,
  });
}

export async function reloadAndWait(tabId: number): Promise<void> {
  await chrome.tabs.reload(tabId);
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 4000);
    const listener = (updatedId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedId === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

export async function requestPageData(tabId: number): Promise<PlatformPageData> {
  try {
    return await sendGetPageData(tabId);
  } catch {
    try {
      await injectContentScript(tabId);
      await new Promise((resolve) => setTimeout(resolve, 250));
      return await sendGetPageData(tabId);
    } catch {
      throw new Error('CAPTURE_FAILED');
    }
  }
}
