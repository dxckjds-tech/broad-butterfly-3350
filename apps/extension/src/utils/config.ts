const STORAGE_KEY = 'apiBaseUrl';

export const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/** @deprecated use getApiBaseUrl() — kept as the compile-time default */
export const API_BASE_URL = DEFAULT_API_BASE_URL;

export function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_API_BASE_URL;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return DEFAULT_API_BASE_URL;
  }
  let path = url.pathname.replace(/\/+$/, '');
  if (!path || path === '/') path = '/api';
  else if (!path.endsWith('/api')) path = `${path}/api`;
  return `${url.origin}${path}`;
}

export async function getApiBaseUrl(): Promise<string> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const stored = String(data[STORAGE_KEY] ?? '').trim();
    return stored ? normalizeApiBaseUrl(stored) : DEFAULT_API_BASE_URL;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

export async function setApiBaseUrl(raw: string): Promise<string> {
  const normalized = normalizeApiBaseUrl(raw);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

export async function ensureApiHostAccess(apiBase: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(normalizeApiBaseUrl(apiBase));
  } catch {
    return false;
  }
  const origin = `${url.protocol}//${url.host}/*`;
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
  if (!chrome?.permissions?.request) return true;
  try {
    const has = await chrome.permissions.contains({ origins: [origin] });
    if (has) return true;
    return await chrome.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}
