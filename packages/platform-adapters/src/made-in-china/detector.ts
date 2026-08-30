import type { PageType } from '@trade-ai/shared-types';
import { getFirstText, looksLike } from '../base/query';
import { detectVirtualOfficePageType } from './virtual-office/product-edit/detector';
import { MIC_HOST_PATTERN, MIC_PRODUCT_URL_PATTERNS, MIC_SHOP_URL_PATTERNS } from './selectors';

export function isMadeInChinaHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (MIC_HOST_PATTERN.test(parsed.hostname)) return true;
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

function hasText(doc: Document, pattern: RegExp): boolean {
  try {
    return pattern.test(doc.body?.innerText ?? '');
  } catch {
    return false;
  }
}

export function detectMicPageType(doc: Document, url: string): PageType {
  try {
    const vo = detectVirtualOfficePageType(doc, url);
    if (vo) return vo.pageType;

    const urlProduct = looksLike(url, MIC_PRODUCT_URL_PATTERNS);
    const urlShop = looksLike(url, MIC_SHOP_URL_PATTERNS) && !urlProduct;

    const h1 = getFirstText(doc, ['h1'])?.text ?? '';
    const hasH1 = h1.length >= 4;
    const hasProductHeading = /product description|product details|specification|basic info/i.test(
      doc.body?.innerText ?? '',
    );
    const hasContactSupplier = hasText(doc, /contact supplier|send inquiry|start order/i);
    const hasGallery = Boolean(
      doc.querySelector('.sr-proImg, .pro-img, .pic-box, [class*="gallery"] img, [itemprop="image"]'),
    );
    const hasSpecs = Boolean(
      doc.querySelector('table, dl dt, [class*="basic"][class*="info"], [itemprop="additionalProperty"]'),
    );
    const hasProductSchema = Boolean(
      doc.querySelector('[itemtype*="Product"], script[type="application/ld+json"]'),
    );
    const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute('content') ?? '';

    let productSignals = 0;
    if (urlProduct) productSignals += 2;
    if (hasH1) productSignals += 1;
    if (hasProductHeading) productSignals += 1;
    if (hasContactSupplier) productSignals += 1;
    if (hasGallery) productSignals += 1;
    if (hasSpecs) productSignals += 1;
    if (hasProductSchema || ogType === 'product') productSignals += 1;

    if (productSignals >= 2) return 'PRODUCT';
    if (urlShop || ogType === 'profile' || ogType === 'company') return 'SHOP';
    if (doc.querySelector('.company-name, .showroom, [class*="company-profile"]')) return 'SHOP';
    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}
