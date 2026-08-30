import type { PageType } from '@trade-ai/shared-types';
import { looksLike } from '../base/dom';
import { MIC_HOST_PATTERN, MIC_PRODUCT_URL_PATTERNS, MIC_SHOP_URL_PATTERNS } from './selectors';

export function isMadeInChinaHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (MIC_HOST_PATTERN.test(parsed.hostname)) return true;
    // Local demo fixture used in Phase 1 development.
    if (
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      parsed.pathname.includes('/demo/mic-')
    ) {
      return true;
    }
    return false;
  } catch {
    return /made-in-china\.com/i.test(url);
  }
}

export function detectMicPageType(doc: Document, url: string): PageType {
  try {
    if (looksLike(url, MIC_PRODUCT_URL_PATTERNS)) return 'PRODUCT';
    if (looksLike(url, MIC_SHOP_URL_PATTERNS)) return 'SHOP';

    const hasProductSchema = Boolean(
      doc.querySelector('[itemtype*="Product"], .product-name, .pro-name'),
    );
    const h1 = doc.querySelector('h1')?.textContent?.trim() ?? '';
    if (hasProductSchema || /product|handle|machine|parts/i.test(h1)) {
      return 'PRODUCT';
    }

    const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute('content');
    if (ogType === 'product') return 'PRODUCT';
    if (ogType === 'profile' || ogType === 'company') return 'SHOP';

    if (doc.querySelector('.company-name, .showroom')) return 'SHOP';
    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}
