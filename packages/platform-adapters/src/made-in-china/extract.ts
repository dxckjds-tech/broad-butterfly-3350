import { getFirstText, metaContent, normalizeText } from '../base/query';
import { MIC_SELECTORS } from './selectors';

const TITLE_NOISE = [
  /made-in-china\.com/gi,
  /\bchina manufacturer\b/gi,
  /\bmanufacturer\s*&\s*supplier\b/gi,
  /\bsupplier\b/gi,
  /\bfactory\b/gi,
  /\bwholesale\b/gi,
  /\bproduct list\b/gi,
];

export function cleanProductTitle(raw: string): string {
  let text = normalizeText(raw);
  const parts = text.split(/\s*[|–—]\s*/);
  if (parts.length > 1) {
    text = parts.filter((part) => !/made-in-china/i.test(part))[0] ?? text;
  }
  for (const noise of TITLE_NOISE) {
    text = text.replace(noise, ' ');
  }
  return normalizeText(text.replace(/^[\-–—|,]+|[\-–—|,]+$/g, ''));
}

export function readJsonLd(doc: Document): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  try {
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      try {
        const parsed: unknown = JSON.parse(el.textContent || 'null');
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>;
            nodes.push(record);
            const graph = record['@graph'];
            if (Array.isArray(graph)) {
              graph.forEach((node) => {
                if (node && typeof node === 'object') nodes.push(node as Record<string, unknown>);
              });
            }
          }
        }
      } catch {
        // ignore invalid json-ld
      }
    });
  } catch {
    // ignore
  }
  return nodes;
}

function ldType(node: Record<string, unknown>, type: string): boolean {
  const value = node['@type'];
  if (typeof value === 'string') return value.toLowerCase() === type.toLowerCase();
  if (Array.isArray(value)) return value.some((item) => String(item).toLowerCase() === type.toLowerCase());
  return false;
}

export function jsonLdProduct(doc: Document): Record<string, unknown> | null {
  return readJsonLd(doc).find((node) => ldType(node, 'Product')) ?? null;
}

export function jsonLdString(value: unknown): string {
  if (typeof value === 'string') return normalizeText(value);
  if (value && typeof value === 'object' && 'name' in value) {
    return jsonLdString((value as { name: unknown }).name);
  }
  return '';
}

const IMAGE_NOISE = /logo|icon|avatar|qr[-_]?code|qrcode|sprite|pixel|tracking|1x1|spacer|badge|flag/i;

function imageUrlFromEl(el: Element): string {
  const html = el as HTMLImageElement;
  const candidates = [
    html.currentSrc,
    html.getAttribute('src'),
    html.getAttribute('data-src'),
    html.getAttribute('data-original'),
    html.getAttribute('data-lazy'),
    html.getAttribute('data-url'),
    html.getAttribute('data-img'),
  ];
  for (const item of candidates) {
    const url = normalizeText(item);
    if (url && !url.startsWith('data:image/gif') && url.length > 8) return url;
  }
  return '';
}

function isTinyImage(el: Element): boolean {
  const width = Number((el as HTMLImageElement).getAttribute('width') || (el as HTMLImageElement).width || 0);
  const height = Number((el as HTMLImageElement).getAttribute('height') || (el as HTMLImageElement).height || 0);
  if (width > 0 && height > 0 && (width < 60 || height < 60)) return true;
  return false;
}

export function collectProductImages(doc: Document, limit = 20): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const selector of MIC_SELECTORS.images) {
    try {
      doc.querySelectorAll(selector).forEach((el) => {
        if (isTinyImage(el)) return;
        const url = imageUrlFromEl(el);
        if (!url || IMAGE_NOISE.test(url)) return;
        const key = url.split('?')[0] ?? url;
        if (seen.has(key)) return;
        seen.add(key);
        urls.push(url);
      });
    } catch {
      // ignore
    }
    if (urls.length >= limit) break;
  }
  return urls.slice(0, limit);
}

function putSpec(specs: Record<string, string>, key: string, value: string): void {
  const k = normalizeText(key).replace(/[:：]+$/, '');
  const v = normalizeText(value);
  if (!k || !v) return;
  if (!(k in specs)) specs[k] = v;
}

export function parseSpecifications(doc: Document): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const selector of MIC_SELECTORS.specTables) {
    try {
      doc.querySelectorAll(selector).forEach((table) => {
        table.querySelectorAll('tr').forEach((row) => {
          const cells = row.querySelectorAll('th,td');
          if (cells.length >= 2) {
            putSpec(specs, cells.item(0)?.textContent ?? '', cells.item(1)?.textContent ?? '');
          }
        });
      });
    } catch {
      // ignore
    }
    if (Object.keys(specs).length >= 3) break;
  }

  try {
    doc.querySelectorAll('dl').forEach((list) => {
      const dts = list.querySelectorAll('dt');
      dts.forEach((dt) => {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName.toLowerCase() === 'dd') {
          putSpec(specs, dt.textContent ?? '', dd.textContent ?? '');
        }
      });
    });
  } catch {
    // ignore
  }

  try {
    doc.querySelectorAll(MIC_SELECTORS.specLists.join(',')).forEach((item) => {
      const text = normalizeText(item.textContent);
      const match = text.match(/^(.{2,60}?)[:：]\s*(.{1,120})$/);
      if (match?.[1] && match[2]) putSpec(specs, match[1], match[2]);
    });
  } catch {
    // ignore
  }

  return specs;
}

const MOQ_RE =
  /(?:min(?:imum)?\.?\s*order(?:\s*quantity)?|moq|起订量)\s*[:：]?\s*(\d[\w\s./-]{0,48}(?:pieces?|pcs|sets?|units?|boxes?|meters?|kg|ton)?)/i;

export function extractMoq(
  doc: Document,
  blob: string,
  specifications: Record<string, string> = {},
): { value: string; matched: string } {
  for (const [key, value] of Object.entries(specifications)) {
    if (/moq|min\.?\s*order/i.test(key) && /\d/.test(value)) {
      return { value, matched: 'specifications' };
    }
  }
  const fromDom = getFirstText(doc, MIC_SELECTORS.moq);
  if (fromDom && /\d/.test(fromDom.text) && /moq|order|pcs|piece|set|unit/i.test(fromDom.text)) {
    return { value: fromDom.text, matched: fromDom.matched };
  }
  const specLike = blob.match(MOQ_RE);
  if (specLike?.[1]) return { value: normalizeText(specLike[1]), matched: 'text-regex' };
  return { value: '', matched: '' };
}

const DELIVERY_RE =
  /(?:lead time|delivery time|production time|shipment|交货期)\s*[:：]?\s*((?:within\s*)?\d[\w\s.-]{0,40}days?)/i;

export function extractDelivery(
  doc: Document,
  blob: string,
  specifications: Record<string, string> = {},
): { value: string; matched: string } {
  for (const [key, value] of Object.entries(specifications)) {
    if (/lead time|delivery|production time|shipment/i.test(key) && value) {
      return { value, matched: 'specifications' };
    }
  }
  const fromDom = getFirstText(doc, MIC_SELECTORS.delivery);
  if (fromDom && /day|week|month|\d/i.test(fromDom.text)) {
    return { value: fromDom.text, matched: fromDom.matched };
  }
  const match = blob.match(DELIVERY_RE);
  if (match?.[1]) return { value: normalizeText(match[1]), matched: 'text-regex' };
  return { value: '', matched: '' };
}

const OEM_PHRASES =
  /\b(oem service|odm service|oem\/odm|odm\/oem|accept oem|oem available|customized|customization|custom logo|custom packaging|custom design|customi[sz]ed service)\b/i;

export function detectOem(specifications: Record<string, string>, blob: string): boolean {
  const specHit = Object.entries(specifications).some(([key, value]) => {
    if (!/oem|odm|custom/i.test(key)) return false;
    return /yes|available|support|provided|true|oem|odm/i.test(value);
  });
  if (specHit) return true;
  const stripped = blob.replace(/\bno\s+customi[sz]ed[^.!?]*/gi, ' ');
  return OEM_PHRASES.test(stripped);
}

const CERTS = ['CE', 'RoHS', 'ISO', 'FCC', 'UL', 'GS', 'ETL', 'TUV', 'SGS', 'FDA', 'REACH'];

export function extractCertifications(
  specifications: Record<string, string>,
  blob: string,
): string[] {
  const haystack = `${Object.entries(specifications)
    .map(([k, v]) => `${k} ${v}`)
    .join(' ')} ${blob}`;
  return CERTS.filter((item) => new RegExp(`\\b${item}\\b`, 'i').test(haystack));
}

const DESC_HEADINGS =
  /^(product description|product details|description|overview|detailed information|product intro)/i;

export function extractDescription(doc: Document): { value: string; matched: string } {
  const direct = getFirstText(doc, MIC_SELECTORS.description);
  if (direct && direct.text.length >= 40) return { value: direct.text.slice(0, 8000), matched: direct.matched };

  try {
    const headings = doc.querySelectorAll(MIC_SELECTORS.descriptionHeadings.join(','));
    for (const heading of Array.from(headings)) {
      const title = normalizeText(heading.textContent);
      if (!DESC_HEADINGS.test(title)) continue;
      let sibling = heading.nextElementSibling;
      const chunks: string[] = [];
      while (sibling && chunks.join(' ').length < 6000) {
        const tag = sibling.tagName.toLowerCase();
        if (/^h[1-4]$/.test(tag)) break;
        const text = normalizeText(sibling.textContent);
        if (text.length > 20) chunks.push(text);
        sibling = sibling.nextElementSibling;
      }
      const value = normalizeText(chunks.join(' '));
      if (value.length >= 40) return { value: value.slice(0, 8000), matched: 'heading-section' };
    }
  } catch {
    // ignore
  }

  const meta = metaContent(doc, ['og:description', 'description']);
  if (meta && meta.text.length >= 40) return { value: meta.text, matched: meta.matched };
  return { value: '', matched: '' };
}

export function extractRawText(doc: Document, max = 40000): string {
  try {
    const clone = doc.body?.cloneNode(true) as HTMLElement | undefined;
    if (!clone) return '';
    clone
      .querySelectorAll('script,style,nav,footer,header,iframe,noscript,[class*="cookie"],[id*="cookie"]')
      .forEach((el) => el.remove());
    return normalizeText(clone.innerText).slice(0, max);
  } catch {
    try {
      return normalizeText(doc.body?.innerText).slice(0, max);
    } catch {
      return '';
    }
  }
}

export function extractKeywords(doc: Document, extra: string[]): string[] {
  const fromMeta = metaContent(doc, ['keywords', 'news_keywords']);
  const parts = [...(fromMeta?.text.split(/[,，;；|]/) ?? []), ...extra]
    .map((item) => normalizeText(item))
    .filter((item) => item.length > 1 && item.length < 80);
  return Array.from(new Set(parts)).slice(0, 20);
}

export function extractCompanyFromText(blob: string): string {
  const match = blob.match(
    /([A-Z][A-Za-z0-9&.\-\s]{4,80}(?:Co(?:\.|,)?\s*Ltd\.?|Company Limited|Corporation|Inc\.|LLC|GmbH))/,
  );
  return normalizeText(match?.[1] ?? '');
}
