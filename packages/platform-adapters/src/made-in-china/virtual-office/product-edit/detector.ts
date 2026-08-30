import type { PageType } from '@trade-ai/shared-types';
import { looksLike } from '../../../base/query';
import { PRODUCT_EDIT_LABELS } from './types';

export function isMemberCenterHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)membercenter\.made-in-china\.com$/i.test(host);
  } catch {
    return /membercenter\.made-in-china\.com/i.test(url);
  }
}

function textBlob(doc: Document): string {
  try {
    return `${doc.title || ''} ${doc.body?.innerText || ''}`.slice(0, 20000);
  } catch {
    return doc.title || '';
  }
}

function hits(blob: string, patterns: readonly RegExp[]): number {
  return patterns.reduce((n, re) => n + (re.test(blob) ? 1 : 0), 0);
}

export function detectProductEditConfidence(doc: Document, url: string): { confidence: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  const blob = textBlob(doc);
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }

  if (isMemberCenterHost(url)) {
    score += 0.25;
    signals.push('membercenter-host');
  }
  if (looksLike(path, [/edit/i, /modify/i, /prodmanage/i, /productmanage/i, /offer/i, /comprod/i, /product\.do/i])) {
    score += 0.15;
    signals.push('edit-path');
  }
  if (hits(blob, PRODUCT_EDIT_LABELS.editProduct)) {
    score += 0.2;
    signals.push('edit-title');
  }
  if (hits(blob, PRODUCT_EDIT_LABELS.productName)) {
    score += 0.15;
    signals.push('product-name-label');
  }
  if (hits(blob, PRODUCT_EDIT_LABELS.keywords)) {
    score += 0.1;
    signals.push('keywords-label');
  }
  if (hits(blob, PRODUCT_EDIT_LABELS.centerTerms)) {
    score += 0.08;
    signals.push('center-terms-label');
  }
  if (hits(blob, PRODUCT_EDIT_LABELS.basicInfo)) {
    score += 0.05;
    signals.push('basic-info');
  }
  if (hits(blob, PRODUCT_EDIT_LABELS.submitReview)) {
    score += 0.07;
    signals.push('submit-review');
  }
  if (doc.querySelector('input[name*="prodName" i], input[name*="keyword" i]')) {
    score += 0.1;
    signals.push('form-controls');
  }

  return { confidence: Math.min(1, score), signals };
}

export function isMicProductEditPage(doc: Document, url: string): boolean {
  const { confidence } = detectProductEditConfidence(doc, url);
  return confidence >= 0.45;
}

export function detectVirtualOfficePageType(doc: Document, url: string): { pageType: PageType; confidence: number } | null {
  if (!isMemberCenterHost(url) && !/\/demo\/mic-product-edit/i.test(url)) return null;

  const edit = detectProductEditConfidence(doc, url);
  if (edit.confidence >= 0.45) {
    return { pageType: 'MIC_PRODUCT_EDIT', confidence: edit.confidence };
  }

  const blob = textBlob(doc);
  if (/询盘详情|inquiry\s*detail/i.test(blob) || /\/inquiry\/.+detail/i.test(url)) {
    return { pageType: 'MIC_INQUIRY_DETAIL', confidence: 0.7 };
  }
  if (/询盘管理|询盘列表|\binquir(y|ies)\b/i.test(blob) && /membercenter/i.test(url)) {
    return { pageType: 'MIC_INQUIRY_LIST', confidence: 0.65 };
  }
  if (/产品管理|产品列表|manage\s*products/i.test(blob) || /\/product\/list/i.test(url)) {
    return { pageType: 'MIC_PRODUCT_LIST', confidence: 0.65 };
  }
  return { pageType: 'MIC_VIRTUAL_OFFICE', confidence: 0.55 };
}
