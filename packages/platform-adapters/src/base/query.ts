export interface TextHit {
  text: string;
  matched: string;
}

export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

export function getFirstText(root: ParentNode, selectors: string[]): TextHit | null {
  for (const selector of selectors) {
    try {
      const el = root.querySelector(selector);
      const text = normalizeText(el?.textContent);
      if (text) return { text, matched: selector };
    } catch {
      // invalid selector
    }
  }
  return null;
}

export function getAllTexts(root: ParentNode, selectors: string[]): string[] {
  const values: string[] = [];
  for (const selector of selectors) {
    try {
      root.querySelectorAll(selector).forEach((el) => {
        const text = normalizeText(el.textContent);
        if (text) values.push(text);
      });
    } catch {
      // invalid selector
    }
  }
  return values;
}

export function getFirstAttribute(
  root: ParentNode,
  selectors: string[],
  attr: string,
): TextHit | null {
  for (const selector of selectors) {
    try {
      const el = root.querySelector(selector);
      const value = normalizeText(el?.getAttribute(attr));
      if (value) return { text: value, matched: `${selector}[${attr}]` };
    } catch {
      // invalid selector
    }
  }
  return null;
}

export function metaContent(doc: Document, keys: string[]): TextHit | null {
  for (const key of keys) {
    try {
      const byName = doc.querySelector(`meta[name="${key}"]`)?.getAttribute('content');
      const byProp = doc.querySelector(`meta[property="${key}"]`)?.getAttribute('content');
      const value = normalizeText(byName ?? byProp);
      if (value) {
        const matched = byName
          ? `meta[name="${key}"]`
          : `meta[property="${key}"]`;
        return { text: value, matched };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function looksLike(url: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(url));
}
