import { emptyPageData, type PlatformPageData } from '@trade-ai/shared-types';
import type { PlatformAdapter } from './base/adapter';
import { madeInChinaAdapter } from './made-in-china';

const adapters: PlatformAdapter[] = [madeInChinaAdapter];

export function resolveAdapter(url: string): PlatformAdapter | null {
  return adapters.find((adapter) => adapter.matches(url)) ?? null;
}

export function captureCurrentPage(doc: Document, url: string): PlatformPageData {
  try {
    const adapter = resolveAdapter(url);
    if (!adapter) {
      return emptyPageData({
        url,
        title: doc.title ?? '',
        capturedAt: new Date().toISOString(),
      });
    }
    return adapter.parse(doc, url);
  } catch {
    return emptyPageData({
      url,
      title: doc.title ?? '',
      capturedAt: new Date().toISOString(),
    });
  }
}

export { madeInChinaAdapter };
export { MadeInChinaAdapter } from './made-in-china';
export type { PlatformAdapter } from './base/adapter';
