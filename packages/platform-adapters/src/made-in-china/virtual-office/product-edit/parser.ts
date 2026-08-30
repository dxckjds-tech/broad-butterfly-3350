import {
  emptyPageData,
  type DataReadinessItem,
  type FieldEvidenceSource,
  type FieldStatusMap,
  type FieldStatus,
  type PlatformPageData,
  type SectionLoadState,
} from '@trade-ai/shared-types';
import { getFirstText } from '../../../base/query';
import { isParserDebugEnabled } from '../../debug';
import { cleanProductTitle, extractCompanyFromText, extractRawText } from '../../extract';
import { computeParseQuality, statusForValue } from '../../quality';
import { MIC_SELECTORS } from '../../selectors';
import { detectProductEditConfidence } from './detector';
import { findSectionRoot, readFieldByLabel, readInputValue, readTextareaValue, sectionLooksCollapsed } from './form-reader';
import { parseCenterTerms, parseKeywords } from './keyword-parser';
import { PRODUCT_EDIT_SELECTORS, IMAGE_UI_NOISE } from './selectors';
import { parseSpecificationsForm } from './spec-parser';
import { parseTradeInfo } from './trade-info-parser';
import { MIC_ADAPTER_VERSION, PRODUCT_EDIT_LABELS } from './types';

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function analyzeCategoryRelevance(title: string, category: string) {
  if (!title || !category) {
    return {
      status: 'UNCERTAIN' as const,
      title,
      category,
      message: '类目或标题不完整，暂无法判断匹配度。',
    };
  }
  const t = tokens(title);
  const c = tokens(category);
  const overlap = c.filter((w) => t.includes(w));
  const categoryOnly = c.filter((w) => !t.includes(w));
  const titleOnly = t.filter((w) => !c.includes(w) && /vacuum|cleaner|washer|machine|pump|motor/.test(w));
  if (overlap.length === c.length) {
    return { status: 'MATCH' as const, title, category, message: '所选子目录与产品名称用语一致。' };
  }
  if (overlap.length && (categoryOnly.length || titleOnly.length)) {
    return {
      status: 'POSSIBLE_MISMATCH' as const,
      title,
      category,
      message: '当前产品名称与所选 MIC 子目录可能存在匹配度问题，建议人工确认类目。',
    };
  }
  if (!overlap.length) {
    return {
      status: 'MISMATCH' as const,
      title,
      category,
      message: '当前产品名称与所选 MIC 子目录可能存在匹配度问题，建议人工确认类目。',
    };
  }
  return { status: 'UNCERTAIN' as const, title, category, message: '类目匹配度需要人工确认。' };
}

function collectBackendImages(doc: Document): { urls: string[]; state: SectionLoadState } {
  const section = findSectionRoot(doc, PRODUCT_EDIT_LABELS.images);
  const roots = [section, doc.querySelector('[class*="upload"]'), doc.querySelector('[class*="prod-pic"]')].filter(
    Boolean,
  ) as Element[];
  const urls: string[] = [];
  const seen = new Set<string>();
  const pushUrl = (raw: string) => {
    const url = raw.replace(/^url\(["']?/, '').replace(/["']?\)$/, '').trim();
    if (!url || url.startsWith('data:image/gif') || url.length < 8) return;
    if (IMAGE_UI_NOISE.test(url)) return;
    const key = url.split('?')[0] ?? url;
    if (seen.has(key)) return;
    seen.add(key);
    urls.push(url);
  };

  const scan = (root: ParentNode) => {
    root.querySelectorAll('img').forEach((img) => {
      const html = img as HTMLImageElement;
      const alt = `${html.alt || ''} ${html.className || ''} ${html.getAttribute('src') || ''}`;
      if (IMAGE_UI_NOISE.test(alt)) return;
      const w = Number(html.getAttribute('width') || html.width || 0);
      const h = Number(html.getAttribute('height') || html.height || 0);
      if (w > 0 && h > 0 && (w < 40 || h < 40)) return;
      for (const attr of ['src', 'data-src', 'data-original', 'data-lazy', 'data-url']) {
        const v = html.getAttribute(attr);
        if (v) {
          pushUrl(v);
          break;
        }
      }
    });
    root.querySelectorAll('[style*="background-image"]').forEach((el) => {
      const m = (el.getAttribute('style') || '').match(/background-image:\s*url\(([^)]+)\)/i);
      if (m?.[1]) pushUrl(m[1]);
    });
    PRODUCT_EDIT_SELECTORS.imageUpload.forEach((sel) => {
      try {
        root.querySelectorAll(sel).forEach((el) => {
          if (el.tagName.toLowerCase() === 'img') {
            const v = (el as HTMLImageElement).getAttribute('src') || el.getAttribute('data-src');
            if (v) pushUrl(v);
          }
        });
      } catch {
        // ignore
      }
    });
  };

  if (roots.length) roots.forEach(scan);
  else scan(doc);

  let state: SectionLoadState = 'NOT_LOADED';
  if (section && !sectionLooksCollapsed(section)) state = urls.length ? 'LOADED' : 'PARTIAL';
  else if (urls.length) state = 'LOADED';
  else if (section) state = 'PARTIAL';
  return { urls, state };
}

function readiness(items: DataReadinessItem[]) {
  const score = items.length ? Math.round((items.filter((i) => i.ok).length / items.length) * 100) : 0;
  return { score, items };
}

export function parseMicProductEditPage(doc: Document, url: string): PlatformPageData {
  const { confidence } = detectProductEditConfidence(doc, url);
  const evidence: Record<string, FieldEvidenceSource> = {};
  const matchedSelectors: Record<string, string> = {};
  const warnings: string[] = [];

  let productName = '';
  const nameFromLabel = readFieldByLabel(doc, PRODUCT_EDIT_LABELS.productName);
  if (nameFromLabel.value) {
    productName = cleanProductTitle(nameFromLabel.value);
    matchedSelectors.productName = nameFromLabel.matched;
    evidence.productName = 'BACKEND_FORM';
  }
  if (!productName) {
    for (const sel of PRODUCT_EDIT_SELECTORS.productNameInputs) {
      const el = doc.querySelector(sel);
      const v = readInputValue(el) || readTextareaValue(el);
      if (v) {
        productName = cleanProductTitle(v);
        matchedSelectors.productName = sel;
        evidence.productName = 'BACKEND_FORM';
        break;
      }
    }
  }
  if (!productName) {
    const h1 = getFirstText(doc, ['h1']);
    if (h1) {
      productName = cleanProductTitle(h1.text);
      matchedSelectors.productName = 'h1';
      evidence.productName = 'BACKEND_TEXT';
    }
  }
  if (!productName && doc.title) {
    productName = cleanProductTitle(doc.title);
    matchedSelectors.productName = 'document.title';
    evidence.productName = 'BACKEND_TEXT';
  }

  const companyHit = getFirstText(doc, MIC_SELECTORS.companyName);
  let companyName = companyHit?.text ?? '';
  if (companyHit) {
    matchedSelectors.companyName = companyHit.matched;
    evidence.companyName = 'BACKEND_TEXT';
  }

  const kw = parseKeywords(doc);
  const keywords = kw.keywords.filter((item) => item !== productName && item !== companyName);
  if (kw.matched) matchedSelectors.keywords = kw.matched;
  evidence.keywords = kw.status === 'FOUND' ? 'BACKEND_FORM' : 'UNKNOWN';

  const center = parseCenterTerms(doc);
  if (center.matched) matchedSelectors.centerTerms = center.matched;
  evidence.centerTerms = center.status === 'FOUND' ? 'BACKEND_FORM' : 'UNKNOWN';

  let category = '';
  let categorySource = '';
  const catHit = readFieldByLabel(doc, PRODUCT_EDIT_LABELS.category);
  if (catHit.value) {
    category = catHit.value.replace(/^已选子目录[:：]?\s*/i, '');
    categorySource = 'BACKEND_SELECTED_CATEGORY';
    matchedSelectors.category = catHit.matched;
    evidence.category = 'BACKEND_FORM';
  }
  if (!category) {
    const node = doc.querySelector(PRODUCT_EDIT_SELECTORS.categorySelected.join(','));
    const text = (node?.textContent || '').replace(/^已选子目录[:：]?\s*/i, '').trim();
    if (text) {
      category = text;
      categorySource = 'BACKEND_SELECTED_CATEGORY';
      matchedSelectors.category = 'selected-category';
      evidence.category = 'BACKEND_FORM';
    }
  }

  const specs = parseSpecificationsForm(doc);
  if (specs.matched) matchedSelectors.specifications = specs.matched;
  evidence.specifications = specs.status === 'FOUND' ? 'BACKEND_FORM' : 'UNKNOWN';

  const images = collectBackendImages(doc);
  if (images.urls.length) {
    matchedSelectors.images = 'upload-area';
    evidence.images = 'BACKEND_FORM';
  } else {
    evidence.images = 'UNKNOWN';
  }

  const trade = parseTradeInfo(doc);
  if (trade.matched.moq) {
    matchedSelectors.moq = trade.matched.moq;
    evidence.moq = 'BACKEND_FORM';
  }
  if (trade.matched.delivery) {
    matchedSelectors.deliveryTime = trade.matched.delivery;
    evidence.deliveryTime = 'BACKEND_FORM';
  }

  const descHit = readFieldByLabel(doc, [/产品描述/, /product\s*description/i]);
  const description = descHit.value;
  if (description) {
    matchedSelectors.description = descHit.matched;
    evidence.description = 'BACKEND_FORM';
  }

  const rawText = extractRawText(doc);
  if (!companyName) companyName = extractCompanyFromText(`${productName} ${rawText}`);

  const sections: Record<string, SectionLoadState> = {
    BASIC_INFO: productName ? 'LOADED' : 'PARTIAL',
    KEYWORDS: kw.status === 'FOUND' ? 'LOADED' : 'NOT_LOADED',
    CENTER_TERMS: center.status === 'FOUND' ? 'LOADED' : 'NOT_LOADED',
    SPECIFICATIONS: specs.specDebug.rawSpecificationCount ? 'LOADED' : specs.status === 'UNCERTAIN' ? 'NOT_LOADED' : 'PARTIAL',
    IMAGES: images.state,
    TRADE_INFO: trade.tradeLoaded || trade.moq ? 'LOADED' : 'NOT_LOADED',
    OEM: trade.oemLoaded ? 'LOADED' : 'NOT_LOADED',
  };

  const field = (found: boolean, uncertain: boolean): FieldStatus => statusForValue(found, { uncertain });

  const fieldStatus: FieldStatusMap = {
    productName: field(productName.length >= 4, evidence.productName !== 'BACKEND_FORM' && Boolean(productName)),
    companyName: field(companyName.length >= 3, false),
    description: field(description.length >= 40, !description && sections.BASIC_INFO === 'LOADED'),
    images:
      images.urls.length > 0
        ? 'FOUND'
        : images.state === 'NOT_LOADED' || images.state === 'PARTIAL'
          ? 'UNCERTAIN'
          : 'MISSING',
    specifications:
      specs.specDebug.rawSpecificationCount >= 1
        ? 'FOUND'
        : sections.SPECIFICATIONS === 'NOT_LOADED'
          ? 'UNCERTAIN'
          : 'MISSING',
    category: field(category.length >= 2, false),
    moq: trade.moq ? 'FOUND' : sections.TRADE_INFO === 'NOT_LOADED' ? 'UNCERTAIN' : 'MISSING',
    deliveryTime: trade.deliveryTime ? 'FOUND' : sections.TRADE_INFO === 'NOT_LOADED' ? 'UNCERTAIN' : 'MISSING',
    oemAvailable: trade.oemKnown ? 'FOUND' : 'UNCERTAIN',
    certifications: field(false, true),
    keywords: kw.status === 'FOUND' ? 'FOUND' : 'UNCERTAIN',
    rawText: field(rawText.length > 40, false),
  };

  const categoryRelevance = analyzeCategoryRelevance(productName, category);
  const readyItems: DataReadinessItem[] = [
    { key: 'title', label: '标题', ok: Boolean(productName), detail: productName || '未识别' },
    { key: 'category', label: '类目', ok: Boolean(category), detail: category || '未识别' },
    { key: 'keywords', label: '关键词', ok: keywords.length > 0, detail: String(keywords.length) },
    { key: 'centerTerms', label: '中心词', ok: center.terms.length > 0, detail: String(center.terms.length) },
    {
      key: 'specifications',
      label: '参数',
      ok: specs.specDebug.rawSpecificationCount > 0,
      detail: String(specs.specDebug.rawSpecificationCount),
    },
    { key: 'images', label: '图片', ok: images.urls.length > 0, detail: images.state === 'LOADED' ? `${images.urls.length}` : '区域未完整加载' },
    { key: 'moq', label: 'MOQ', ok: Boolean(trade.moq), detail: trade.moq || '区域未加载' },
    { key: 'oem', label: 'OEM', ok: trade.oemKnown, detail: trade.oemKnown ? String(trade.oemAvailable) : '区域未加载' },
  ];
  const dataReadiness = readiness(readyItems);
  if (dataReadiness.score < 70) warnings.push('当前编辑页面部分模块尚未加载，本次诊断可能不完整。');
  if (categoryRelevance.status === 'POSSIBLE_MISMATCH' || categoryRelevance.status === 'MISMATCH') {
    warnings.push(categoryRelevance.message);
  }

  const parseQuality = computeParseQuality(fieldStatus, warnings);
  const fieldsFound = Object.entries(fieldStatus)
    .filter(([, s]) => s === 'FOUND')
    .map(([k]) => k);
  const fieldsMissing = Object.entries(fieldStatus)
    .filter(([, s]) => s !== 'FOUND')
    .map(([k]) => k);

  const parseDebug = isParserDebugEnabled()
    ? {
        detectedPageType: 'MIC_PRODUCT_EDIT' as const,
        pageTypeConfidence: confidence,
        fieldsFound,
        fieldsMissing,
        matchedSelectors,
        title: productName,
        category,
        keywords,
        centerTerms: center.terms,
        specifications: specs.specifications,
        images: images.urls,
        moq: trade.moq,
        deliveryTime: trade.deliveryTime,
        oem: trade.oemKnown ? trade.oemAvailable : null,
        sectionAvailability: sections,
        fieldSource: evidence,
        parseConfidence: parseQuality.score / 100,
      }
    : null;

  return emptyPageData({
    platform: 'MADE_IN_CHINA',
    pageType: 'MIC_PRODUCT_EDIT',
    pageTypeConfidence: confidence,
    diagnosisMode: 'BACKEND_EDIT',
    adapterVersion: MIC_ADAPTER_VERSION,
    url,
    title: productName,
    companyName,
    productName,
    description,
    keywords,
    primaryKeywords: keywords.slice(0, 3),
    keywordCount: keywords.length,
    centerTerms: center.terms,
    centerTermCount: center.terms.length,
    images: images.urls,
    specifications: specs.specifications,
    specDebug: specs.specDebug,
    category,
    categorySource,
    categoryRelevance,
    moq: trade.moq,
    deliveryTime: trade.deliveryTime,
    oemAvailable: trade.oemAvailable,
    certifications: [],
    rawText,
    capturedAt: new Date().toISOString(),
    fieldStatus,
    fieldEvidence: evidence,
    sectionAvailability: sections,
    dataReadiness,
    parseQuality,
    parseDebug,
  });
}
