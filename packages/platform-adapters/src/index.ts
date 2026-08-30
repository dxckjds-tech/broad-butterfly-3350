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
export { parseMadeInChinaPage } from './made-in-china/parser';
export { detectMicPageType, isMadeInChinaHost } from './made-in-china/detector';
export { computeParseQuality, fieldLabel } from './made-in-china/quality';
export { getAllTexts, getFirstAttribute, getFirstText } from './base/query';
export type { PlatformAdapter } from './base/adapter';
