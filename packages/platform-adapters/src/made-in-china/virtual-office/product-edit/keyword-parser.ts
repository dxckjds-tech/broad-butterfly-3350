import { normalizeText } from '../../../base/query';
import { findSectionRoot, readCheckedValues, readRepeatingInputs, regionAfterLabel } from './form-reader';
import { PRODUCT_EDIT_SELECTORS } from './selectors';
import { PRODUCT_EDIT_LABELS } from './types';

export function parseKeywords(doc: Document): { keywords: string[]; matched: string; status: 'FOUND' | 'UNCERTAIN' } {
  const section = regionAfterLabel(doc, PRODUCT_EDIT_LABELS.keywords) ?? findSectionRoot(doc, PRODUCT_EDIT_LABELS.keywords);
  const fromSection = section ? readRepeatingInputs(section, [...PRODUCT_EDIT_SELECTORS.keywordInputs]) : [];
  const fromNamed: string[] = [];
  const seen = new Set<string>();
  for (const sel of PRODUCT_EDIT_SELECTORS.keywordInputs) {
    try {
      doc.querySelectorAll(sel).forEach((el) => {
        const value = (el as HTMLInputElement).value?.trim() || el.getAttribute('value') || '';
        const n = value.replace(/\s+/g, ' ').trim();
        if (n.length >= 2 && n.length <= 80 && !seen.has(n.toLowerCase())) {
          seen.add(n.toLowerCase());
          fromNamed.push(n);
        }
      });
    } catch {
      // ignore
    }
  }
  const keywords = (fromSection.length ? fromSection : fromNamed).filter((item) => {
    if (item.length < 2 || item.length > 80) return false;
    if (/产品名称|中心词|提交审核|基本信息/.test(item)) return false;
    return true;
  });
  if (keywords.length) return { keywords, matched: fromSection.length ? 'keyword-section' : 'keyword-named', status: 'FOUND' };
  if (section) return { keywords: [], matched: 'keyword-section-empty', status: 'FOUND' };
  return { keywords: [], matched: '', status: 'UNCERTAIN' };
}

export function parseCenterTerms(doc: Document): { terms: string[]; matched: string; status: 'FOUND' | 'UNCERTAIN' } {
  const section = regionAfterLabel(doc, PRODUCT_EDIT_LABELS.centerTerms) ?? findSectionRoot(doc, PRODUCT_EDIT_LABELS.centerTerms);
  if (!section) {
    const named = readRepeatingInputs(doc, [...PRODUCT_EDIT_SELECTORS.centerTermInputs]);
    if (named.length) return { terms: named, matched: 'center-named', status: 'FOUND' };
    return { terms: [], matched: '', status: 'UNCERTAIN' };
  }
  const checked = readCheckedValues(section);
  const chips = Array.from(section.querySelectorAll('[class*="tag"], [class*="chip"], [data-mic-field="centerTerm"]'))
    .map((el) => normalizeText(el.textContent))
    .filter((t) => t.length >= 2 && t.length <= 40);
  const extra = checked.length
    ? []
    : readRepeatingInputs(section, [...PRODUCT_EDIT_SELECTORS.centerTermInputs]).filter(
        (t) => t.length >= 2 && t.length <= 32 && !/\d/.test(t),
      );
  const terms = Array.from(new Set([...checked, ...extra, ...chips].map((t) => t.toLowerCase()).filter((t) => t.length >= 2)));
  if (terms.length) return { terms, matched: 'center-section', status: 'FOUND' };
  return { terms: [], matched: 'center-section-empty', status: 'FOUND' };
}
