import type { PageType, PlatformPageData } from '@trade-ai/shared-types';
import type { PlatformAdapter } from '../base/adapter';
import { detectMicPageType, isMadeInChinaHost } from './detector';
import { parseMadeInChinaPage } from './parser';

export class MadeInChinaAdapter implements PlatformAdapter {
  readonly platform = 'MADE_IN_CHINA' as const;

  matches(url: string): boolean {
    return isMadeInChinaHost(url);
  }

  detectPageType(doc: Document, url: string): PageType {
    return detectMicPageType(doc, url);
  }

  parse(doc: Document, url: string): PlatformPageData {
    return parseMadeInChinaPage(doc, url);
  }
}

export const madeInChinaAdapter = new MadeInChinaAdapter();
