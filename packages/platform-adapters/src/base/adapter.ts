import type { PageType, Platform, PlatformPageData } from '@trade-ai/shared-types';

export interface PlatformAdapter {
  platform: Platform;
  matches(url: string): boolean;
  detectPageType(doc: Document, url: string): PageType;
  parse(doc: Document, url: string): PlatformPageData;
}
