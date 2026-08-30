import {
  emptyPageData,
  type FieldStatusMap,
  type ParseDebugResult,
  type PlatformPageData,
} from '@trade-ai/shared-types';
import { getFirstText, metaContent } from '../base/query';
import { isParserDebugEnabled } from './debug';
import { detectMicPageType } from './detector';
import {
  cleanProductTitle,
  collectProductImages,
  detectOem,
  extractCertifications,
  extractCompanyFromText,
  extractDelivery,
  extractDescription,
  extractKeywords,
  extractMoq,
  extractRawText,
  jsonLdProduct,
  jsonLdString,
  parseSpecifications,
} from './extract';
import { computeParseQuality, downgradeMissingWhenUncertain, statusForValue } from './quality';
import { MIC_SELECTORS } from './selectors';

function statusFromLength(value: string, min: number, uncertain: boolean): ReturnType<typeof statusForValue> {
  return statusForValue(value.trim().length >= min, { uncertain });
}

export function parseMadeInChinaPage(doc: Document, url: string): PlatformPageData {
  try {
    const matchedSelectors: Record<string, string> = {};
    const pageType = detectMicPageType(doc, url);
    const ldProduct = jsonLdProduct(doc);

    const ogTitle = metaContent(doc, ['og:title', 'twitter:title']);
    const h1 = getFirstText(doc, MIC_SELECTORS.productName);
    let productName = '';
    let productUncertain = false;
    if (h1) {
      productName = cleanProductTitle(h1.text);
      matchedSelectors.productName = h1.matched;
    }
    if (!productName && ldProduct) {
      productName = cleanProductTitle(jsonLdString(ldProduct.name));
      if (productName) matchedSelectors.productName = 'json-ld';
    }
    if (!productName && ogTitle) {
      productName = cleanProductTitle(ogTitle.text);
      productUncertain = true;
      matchedSelectors.productName = ogTitle.matched;
    }
    if (!productName && doc.title) {
      productName = cleanProductTitle(doc.title);
      productUncertain = true;
      matchedSelectors.productName = 'document.title';
    }

    const companyHit = getFirstText(doc, MIC_SELECTORS.companyName);
    let companyName = companyHit?.text ?? '';
    if (companyHit) matchedSelectors.companyName = companyHit.matched;
    if (!companyName && ldProduct) {
      companyName =
        jsonLdString(ldProduct.brand) || jsonLdString(ldProduct.manufacturer) || jsonLdString(ldProduct.seller);
      if (companyName) matchedSelectors.companyName = 'json-ld';
    }
    if (!companyName) {
      const site = metaContent(doc, ['og:site_name']);
      if (site && !/made-in-china/i.test(site.text)) {
        companyName = site.text;
        matchedSelectors.companyName = site.matched;
      }
    }

    const descriptionHit = extractDescription(doc);
    let description = descriptionHit.value;
    if (descriptionHit.matched) matchedSelectors.description = descriptionHit.matched;

    const images = collectProductImages(doc);
    if (images.length) matchedSelectors.images = MIC_SELECTORS.images[0] ?? 'gallery';

    const specifications = parseSpecifications(doc);
    if (Object.keys(specifications).length) matchedSelectors.specifications = 'table|dl';

    const categoryHit = getFirstText(doc, MIC_SELECTORS.category);
    const category = categoryHit?.text ?? jsonLdString(ldProduct?.category);
    if (categoryHit) matchedSelectors.category = categoryHit.matched;
    else if (category) matchedSelectors.category = 'json-ld';

    const rawText = extractRawText(doc);
    const blob = `${productName} ${description} ${rawText} ${Object.values(specifications).join(' ')}`;

    if (!companyName) {
      companyName = extractCompanyFromText(blob);
      if (companyName) matchedSelectors.companyName = 'text-regex';
    }

    const moqHit = extractMoq(doc, blob, specifications);
    const moq = moqHit.value;
    if (moqHit.matched) matchedSelectors.moq = moqHit.matched;

    const deliveryHit = extractDelivery(doc, blob, specifications);
    const deliveryTime = deliveryHit.value;
    if (deliveryHit.matched) matchedSelectors.deliveryTime = deliveryHit.matched;

    const oemAvailable = detectOem(specifications, blob);
    if (oemAvailable) matchedSelectors.oemAvailable = 'oem-phrases|specs';

    const certifications = extractCertifications(specifications, `${description} ${rawText}`);
    if (certifications.length) matchedSelectors.certifications = 'spec|text';

    const keywords = extractKeywords(doc, [productName, category].filter(Boolean));
    if (keywords.length) matchedSelectors.keywords = 'meta|derived';

    let fieldStatus: FieldStatusMap = {
      productName: statusFromLength(productName, 4, productUncertain),
      companyName: statusFromLength(companyName, 3, matchedSelectors.companyName === 'text-regex'),
      description: statusFromLength(description, 40, matchedSelectors.description?.startsWith('meta') ?? false),
      images: statusForValue(images.length > 0),
      specifications: statusForValue(Object.keys(specifications).length >= 2, {
        uncertain: Object.keys(specifications).length === 1,
      }),
      category: statusFromLength(category, 2, false),
      moq: statusForValue(moq.length > 0),
      deliveryTime: statusForValue(deliveryTime.length > 0),
      oemAvailable: oemAvailable ? 'FOUND' : 'MISSING',
      certifications: statusForValue(certifications.length > 0),
      keywords: statusForValue(keywords.length > 0),
      rawText: statusForValue(rawText.length > 40),
    };

    const warnings: string[] = [];
    if (productUncertain) warnings.push('标题来自 meta/document.title，已清洗，仍可能不完整。');
    if (!images.length) warnings.push('未在主图区域识别到产品图片。');
    if (Object.keys(specifications).length < 2) warnings.push('规格参数识别不足。');

    let parseQuality = computeParseQuality(fieldStatus, warnings);
    fieldStatus = downgradeMissingWhenUncertain(fieldStatus, parseQuality);
    parseQuality = computeParseQuality(fieldStatus, warnings);

    const fieldsFound = Object.entries(fieldStatus)
      .filter(([, status]) => status === 'FOUND')
      .map(([key]) => key);
    const fieldsMissing = Object.entries(fieldStatus)
      .filter(([, status]) => status !== 'FOUND')
      .map(([key]) => key);

    const parseDebug: ParseDebugResult | null = isParserDebugEnabled()
      ? {
          detectedPageType: pageType,
          fieldsFound,
          fieldsMissing,
          matchedSelectors,
        }
      : null;

    return emptyPageData({
      platform: 'MADE_IN_CHINA',
      pageType,
      url,
      title: cleanProductTitle(ogTitle?.text || doc.title || productName),
      companyName,
      productName,
      description,
      keywords,
      images,
      specifications,
      category,
      moq,
      deliveryTime,
      oemAvailable,
      certifications,
      rawText,
      capturedAt: new Date().toISOString(),
      fieldStatus,
      parseQuality,
      parseDebug,
    });
  } catch {
    return emptyPageData({
      platform: 'MADE_IN_CHINA',
      url,
      title: cleanProductTitle(doc.title ?? ''),
      capturedAt: new Date().toISOString(),
      parseQuality: { score: 0, foundFields: [], missingFields: ['productName'], warnings: ['parser-exception'] },
    });
  }
}
