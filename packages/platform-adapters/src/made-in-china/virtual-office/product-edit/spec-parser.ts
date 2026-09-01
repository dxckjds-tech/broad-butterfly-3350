import type { SpecIgnoreItem, SpecParseDebug } from '@trade-ai/shared-types';
import { normalizeText } from '../../../base/query';
import { findSectionRoot, isSecretControl, readInputValue, readSelectValue, readTextareaValue, regionAfterLabel } from './form-reader';
import { PRODUCT_EDIT_LABELS } from './types';

const METADATA_KEYS =
  /^(model\s*no\.?|trademark|origin|hs\s*code|production\s*capacity|transport\s*package|place\s*of\s*origin)$/i;

const MEANINGFUL_KEYS =
  /power|voltage|capacity|suction|material|tank|noise|cable|hose|application|motor|air\s*flow|dimension|weight|size|color|pressure|speed|length|width|height/i;

function reasonFor(field: string, value: string): string | null {
  if (!value) return 'empty';
  if (METADATA_KEYS.test(field)) return 'metadata_only';
  if (/^please\s*select|请选择|n\/?a$/i.test(value)) return 'placeholder';
  if (value.length > 180) return 'too_long_ui_text';
  return null;
}

const FORM_CHROME =
  /^(产品名称|关键词|中心词|已选子目录|规格参数|基本信息|产品图片|提交审核|product name|keywords?)$/i;

function put(specs: Record<string, string>, key: string, value: string): void {
  const k = normalizeText(key).replace(/[:：]+$/, '');
  const v = normalizeText(value);
  if (!k || !v) return;
  if (FORM_CHROME.test(k)) return;
  if (!(k in specs)) specs[k] = v;
}

export function parseSpecificationsForm(doc: Document): {
  specifications: Record<string, string>;
  specDebug: SpecParseDebug;
  matched: string;
  status: 'FOUND' | 'UNCERTAIN';
} {
  const specs: Record<string, string> = {};
  const specRegion =
    regionAfterLabel(doc, PRODUCT_EDIT_LABELS.specifications) ??
    findSectionRoot(doc, PRODUCT_EDIT_LABELS.specifications) ??
    findSectionRoot(doc, PRODUCT_EDIT_LABELS.basicInfo);

  const scanRoot = specRegion ?? doc;
  try {
    scanRoot.querySelectorAll('tr').forEach((row) => {
      const cells = row.querySelectorAll('th,td,label');
      if (cells.length < 2) return;
      const key = normalizeText(cells.item(0)?.textContent);
      const control =
        row.querySelector('input,textarea,select') || cells.item(1);
      if (!control || isSecretControl(control)) return;
      const value =
        readInputValue(control) ||
        readTextareaValue(control) ||
        readSelectValue(control) ||
        normalizeText(cells.item(1)?.textContent);
      put(specs, key, value);
    });

    scanRoot.querySelectorAll('.spec-row, [class*="attr-item"], [class*="form-item"]').forEach((row) => {
      const label = normalizeText(row.querySelector('label, .label, th, dt')?.textContent);
      const control = row.querySelector('input,textarea,select');
      if (!label || !control) return;
      const value = readInputValue(control) || readTextareaValue(control) || readSelectValue(control);
      put(specs, label, value);
    });
  } catch {
    // ignore
  }

  const ignored: SpecIgnoreItem[] = [];
  const kept: Record<string, string> = {};
  for (const [field, value] of Object.entries(specs)) {
    const why = reasonFor(field, value);
    if (why) ignored.push({ field, value, reason: why });
    else kept[field] = value;
  }

  const meaningfulSpecificationCount = Object.keys(kept).filter((k) => MEANINGFUL_KEYS.test(`${k} ${kept[k]}`)).length;
  const status: 'FOUND' | 'UNCERTAIN' = Object.keys(specs).length || specRegion ? 'FOUND' : 'UNCERTAIN';

  return {
    specifications: { ...kept, ...Object.fromEntries(ignored.filter((i) => i.reason === 'metadata_only').map((i) => [i.field, i.value])) },
    specDebug: {
      rawSpecificationCount: Object.keys(specs).length,
      meaningfulSpecificationCount,
      ignoredSpecifications: ignored,
    },
    matched: specRegion ? 'spec-section' : Object.keys(specs).length ? 'spec-scan' : '',
    status,
  };
}

export { MEANINGFUL_KEYS };
