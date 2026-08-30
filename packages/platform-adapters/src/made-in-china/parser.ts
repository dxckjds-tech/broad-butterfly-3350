import { emptyPageData, type PlatformPageData } from '@trade-ai/shared-types';
import {
  collectImages,
  collectKeywords,
  firstText,
  metaContent,
  parseSpecTable,
  safeRawText,
} from '../base/dom';
import { detectMicPageType } from './detector';
import { MIC_SELECTORS } from './selectors';

function extractLabeledValue(rawText: string, labels: string[]): string {
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*[:：]\\s*([^|\\n]{1,80})`, 'i');
    const match = rawText.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function detectOem(text: string): boolean {
  return /\boem\b|\bodm\b|customi[sz]e|定制/i.test(text);
}

function extractCertifications(text: string): string[] {
  const known = ['ISO', 'CE', 'RoHS', 'SGS', 'FDA', 'UL', 'TUV', 'REACH'];
  return known.filter((item) => new RegExp(`\\b${item}\\b`, 'i').test(text));
}

export function parseMadeInChinaPage(doc: Document, url: string): PlatformPageData {
  try {
    const pageType = detectMicPageType(doc, url);
    const title = metaContent(doc, ['og:title', 'twitter:title']) || doc.title || '';
    const productName =
      firstText(doc, MIC_SELECTORS.productName) ||
      (pageType === 'PRODUCT' ? title.split('|')[0]?.trim() ?? '' : '');
    const companyName =
      firstText(doc, MIC_SELECTORS.companyName) ||
      metaContent(doc, ['og:site_name']) ||
      '';
    const description =
      firstText(doc, MIC_SELECTORS.description) ||
      metaContent(doc, ['description', 'og:description']);
    const images = collectImages(doc, MIC_SELECTORS.images);
    const specifications = parseSpecTable(doc, MIC_SELECTORS.specTables);
    const rawText = safeRawText(doc);
    const category = firstText(doc, MIC_SELECTORS.category);
    const moq =
      firstText(doc, MIC_SELECTORS.moq) ||
      extractLabeledValue(rawText, ['MOQ', 'Min. Order', 'Minimum Order', '起订量']);
    const deliveryTime =
      firstText(doc, MIC_SELECTORS.delivery) ||
      extractLabeledValue(rawText, ['Delivery Time', 'Lead Time', '交货期']);

    return emptyPageData({
      platform: 'MADE_IN_CHINA',
      pageType,
      url,
      title,
      companyName,
      productName,
      description,
      keywords: collectKeywords(doc, [productName, category].filter(Boolean)),
      images,
      specifications,
      category,
      moq,
      deliveryTime,
      oemAvailable: detectOem(`${productName} ${description} ${rawText}`),
      certifications: extractCertifications(rawText),
      rawText,
      capturedAt: new Date().toISOString(),
    });
  } catch {
    return emptyPageData({
      platform: 'MADE_IN_CHINA',
      url,
      title: doc.title ?? '',
      capturedAt: new Date().toISOString(),
    });
  }
}
