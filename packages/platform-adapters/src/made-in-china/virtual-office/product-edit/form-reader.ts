import { normalizeText } from '../../../base/query';

const SECRET_NAME = /password|passwd|csrf|token|session|cookie|captcha|otp|sms|authorization|auth[_-]?key/i;

function isElement(node: Node | null): node is Element {
  return Boolean(node && node.nodeType === 1);
}

export function isSecretControl(el: Element | null | undefined): boolean {
  if (!el) return true;
  const tag = el.tagName.toLowerCase();
  if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
    if ((el as HTMLElement).isContentEditable) return false;
    return false;
  }
  const input = el as HTMLInputElement;
  const type = (input.type || '').toLowerCase();
  if (type === 'password') return true;
  const ident = `${input.name || ''} ${input.id || ''} ${input.getAttribute('autocomplete') || ''} ${input.className || ''}`;
  if (SECRET_NAME.test(ident)) return true;
  if (type === 'hidden' && SECRET_NAME.test(ident)) return true;
  return false;
}

function visibleEnough(el: Element): boolean {
  const html = el as HTMLElement;
  const style = html.style;
  if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  const aria = html.getAttribute('aria-hidden');
  if (aria === 'true') return false;
  return true;
}

export function readInputValue(el: Element | null | undefined): string {
  if (!el || isSecretControl(el)) return '';
  if (el.tagName.toLowerCase() !== 'input') return '';
  const input = el as HTMLInputElement;
  const type = (input.type || 'text').toLowerCase();
  if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'button' || type === 'submit') return '';
  return normalizeText(input.value);
}

export function readTextareaValue(el: Element | null | undefined): string {
  if (!el || isSecretControl(el) || el.tagName.toLowerCase() !== 'textarea') return '';
  return normalizeText((el as HTMLTextAreaElement).value);
}

export function readSelectValue(el: Element | null | undefined): string {
  if (!el || isSecretControl(el) || el.tagName.toLowerCase() !== 'select') return '';
  const select = el as HTMLSelectElement;
  const selected = select.selectedOptions?.[0];
  const fromOption = normalizeText(selected?.textContent || selected?.value);
  if (fromOption) return fromOption;
  return normalizeText(select.value);
}

export function readCheckedValues(root: ParentNode): string[] {
  const values: string[] = [];
  try {
    root.querySelectorAll('input[type="checkbox"]').forEach((node) => {
      const input = node as HTMLInputElement;
      if (isSecretControl(input) || !input.checked) return;
      const label = associatedLabelText(input);
      const value = normalizeText(label || input.value);
      if (value && !['on', 'true', '1'].includes(value.toLowerCase())) values.push(value);
      else if (label) values.push(label);
    });
  } catch {
    // ignore
  }
  return values;
}

export function readRadioValue(root: ParentNode): string {
  try {
    const checked = root.querySelector('input[type="radio"]:checked') as HTMLInputElement | null;
    if (!checked || isSecretControl(checked)) return '';
    return normalizeText(associatedLabelText(checked) || checked.value);
  } catch {
    return '';
  }
}

export function readContentEditable(el: Element | null | undefined): string {
  if (!el) return '';
  const html = el as HTMLElement;
  if (!html.isContentEditable && html.getAttribute('contenteditable') !== 'true') return '';
  return normalizeText(html.innerText || html.textContent);
}

function associatedLabelText(input: Element): string {
  const id = input.getAttribute('id');
  if (id && input.ownerDocument) {
    const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '');
    const label = input.ownerDocument.querySelector(`label[for="${safeId}"]`);
    const text = normalizeText(label?.textContent);
    if (text) return text;
  }
  const wrap = input.closest('label');
  if (wrap) {
    const clone = wrap.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input,select,textarea').forEach((n) => n.remove());
    return normalizeText(clone.textContent);
  }
  return '';
}

function controlValue(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio') {
      return (el as HTMLInputElement).checked ? normalizeText(associatedLabelText(el) || (el as HTMLInputElement).value) : '';
    }
    return readInputValue(el);
  }
  if (tag === 'textarea') return readTextareaValue(el);
  if (tag === 'select') return readSelectValue(el);
  if ((el as HTMLElement).isContentEditable || el.getAttribute('contenteditable') === 'true') {
    return readContentEditable(el);
  }
  const data = normalizeText(el.getAttribute('data-value') || el.getAttribute('value'));
  return data;
}

function nearestControls(from: Element): Element[] {
  const found: Element[] = [];
  const push = (el: Element | null) => {
    if (el && !isSecretControl(el)) found.push(el);
  };

  if (from.tagName.toLowerCase() === 'label') {
    const htmlFor = from.getAttribute('for');
    if (htmlFor && from.ownerDocument) {
      const byId = from.ownerDocument.getElementById(htmlFor);
      if (byId) push(byId);
    }
  }

  let sibling = from.nextElementSibling;
  let hops = 0;
  while (sibling && hops < 6) {
    if (/^(input|textarea|select)$/i.test(sibling.tagName) || sibling.getAttribute('contenteditable') === 'true') {
      push(sibling);
    }
    sibling.querySelectorAll('input,textarea,select,[contenteditable="true"]').forEach((el) => push(el));
    if (found.length) break;
    sibling = sibling.nextElementSibling;
    hops += 1;
  }

  const row = from.closest('tr, li, .form-item, .form-row, [class*="form-item"], [class*="formItem"], [class*="field"]');
  if (row) {
    row.querySelectorAll('input,textarea,select,[contenteditable="true"]').forEach((el) => push(el));
  }

  const parent = from.parentElement;
  if (parent) {
    parent.querySelectorAll('input,textarea,select,[contenteditable="true"]').forEach((el) => push(el));
  }

  return found.filter((el, i, arr) => arr.indexOf(el) === i);
}

function labelMatches(text: string, patterns: readonly RegExp[]): boolean {
  const t = normalizeText(text);
  if (!t || t.length > 48) return false;
  return patterns.some((re) => re.test(t));
}

export function readFieldByLabel(doc: Document, patterns: readonly RegExp[]): { value: string; matched: string } {
  try {
    const labels = Array.from(doc.querySelectorAll('label, th, dt, .label, [class*="label"]'));
    for (const label of labels) {
      if (!labelMatches(label.textContent ?? '', patterns)) continue;
      const controls = nearestControls(label);
      for (const control of controls) {
        const value = controlValue(control);
        if (value) return { value, matched: 'label-control' };
      }
      const nearText = normalizeText(label.nextElementSibling?.textContent);
      if (nearText && nearText.length < 200 && !labelMatches(nearText, patterns)) {
        return { value: nearText, matched: 'label-text' };
      }
    }

    const walker = doc.createTreeWalker(doc.body || doc, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = normalizeText(node.textContent);
      if (labelMatches(text, patterns) && isElement(node.parentElement)) {
        const controls = nearestControls(node.parentElement);
        for (const control of controls) {
          const value = controlValue(control);
          if (value) return { value, matched: 'text-control' };
        }
      }
      node = walker.nextNode();
    }
  } catch {
    // ignore
  }
  return { value: '', matched: '' };
}

export function readRepeatingInputs(root: ParentNode, extraSelectors: string[] = []): string[] {
  const values: string[] = [];
  const seen = new Set<string>();
  const collect = (el: Element) => {
    if (isSecretControl(el) || !visibleEnough(el)) return;
    const value = controlValue(el);
    if (!value || seen.has(value.toLowerCase())) return;
    seen.add(value.toLowerCase());
    values.push(value);
  };
  try {
    extraSelectors.forEach((sel) => {
      root.querySelectorAll(sel).forEach(collect);
    });
    root.querySelectorAll('input[type="text"], input:not([type]), textarea').forEach(collect);
  } catch {
    // ignore
  }
  return values;
}

export function regionAfterLabel(doc: Document, patterns: readonly RegExp[]): Element | null {
  try {
    const labels = Array.from(doc.querySelectorAll('label, th, dt, legend, h2, h3, h4, .label'));
    for (const label of labels) {
      if (!labelMatches(label.textContent ?? '', patterns)) continue;
      if (label.nextElementSibling) return label.nextElementSibling;
      const parent = label.parentElement;
      if (parent) {
        const nested = parent.querySelector(
          'input:not([type="hidden"]), textarea, select, table, [class*="keyword"], [class*="center"], [class*="upload"], [class*="pic"]',
        );
        if (nested) return nested.parentElement === parent ? parent : (nested.parentElement ?? nested);
        return parent;
      }
    }
  } catch {
    // ignore
  }
  return findSectionRoot(doc, patterns);
}

export function findSectionRoot(doc: Document, patterns: readonly RegExp[]): Element | null {
  try {
    const candidates = Array.from(
      doc.querySelectorAll('h1,h2,h3,h4,legend,label,.title,[class*="title"],[class*="section"]'),
    );
    for (const el of candidates) {
      if (!labelMatches(el.textContent ?? '', patterns)) continue;
      return el.closest('section, fieldset, form, [class*="module"], [class*="panel"], [class*="block"]') ?? el.parentElement;
    }
    const walker = doc.createTreeWalker(doc.body || doc, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (labelMatches(node.textContent ?? '', patterns) && isElement(node.parentElement)) {
        return (
          node.parentElement.closest('section, fieldset, form, [class*="module"], [class*="panel"], [class*="block"]') ??
          node.parentElement.parentElement
        );
      }
      node = walker.nextNode();
    }
  } catch {
    // ignore
  }
  return null;
}

export function sectionLooksCollapsed(el: Element | null): boolean {
  if (!el) return true;
  const html = el as HTMLElement;
  if (html.style?.display === 'none') return true;
  const cls = `${html.className || ''} ${html.getAttribute('aria-expanded') || ''}`;
  if (/collapsed|fold|hidden|is-close/i.test(cls) && html.getAttribute('aria-expanded') === 'false') return true;
  const controls = html.querySelectorAll('input:not([type="hidden"]), textarea, select');
  return controls.length === 0;
}

export function isSafeExpandEnabled(): boolean {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    return String(env?.MIC_SAFE_EXPAND ?? '').toLowerCase() === 'true';
  } catch {
    return false;
  }
}
