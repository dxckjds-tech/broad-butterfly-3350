export function firstText(root: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    try {
      const el = root.querySelector(selector);
      const text = el?.textContent?.replace(/\s+/g, ' ').trim();
      if (text) return text;
    } catch {
      // invalid selector — continue
    }
  }
  return '';
}

export function metaContent(doc: Document, keys: string[]): string {
  for (const key of keys) {
    const byName = doc.querySelector(`meta[name="${key}"]`)?.getAttribute('content');
    const byProp = doc.querySelector(`meta[property="${key}"]`)?.getAttribute('content');
    const value = (byName ?? byProp)?.trim();
    if (value) return value;
  }
  return '';
}

export function collectImages(root: ParentNode, selectors: string[], limit = 20): string[] {
  const urls = new Set<string>();
  for (const selector of selectors) {
    try {
      root.querySelectorAll(selector).forEach((node) => {
        const el = node as HTMLImageElement;
        const src = el.currentSrc || el.src || el.getAttribute('data-src') || el.getAttribute('src');
        if (src && !src.startsWith('data:') && src.length > 8) {
          urls.add(src);
        }
      });
    } catch {
      // ignore
    }
  }
  return Array.from(urls).slice(0, limit);
}

export function parseSpecTable(root: ParentNode, tableSelectors: string[]): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const selector of tableSelectors) {
    try {
      const table = root.querySelector(selector);
      if (!table) continue;
      table.querySelectorAll('tr').forEach((row) => {
        const cells = row.querySelectorAll('th,td');
        if (cells.length >= 2) {
          const key = cells.item(0)?.textContent?.replace(/\s+/g, ' ').trim();
          const value = cells.item(1)?.textContent?.replace(/\s+/g, ' ').trim();
          if (key && value) specs[key] = value;
        }
      });
      if (Object.keys(specs).length > 0) return specs;
    } catch {
      // ignore
    }
  }
  return specs;
}

export function collectKeywords(doc: Document, extra: string[]): string[] {
  const fromMeta = metaContent(doc, ['keywords', 'news_keywords']);
  const parts = [
    ...fromMeta.split(/[,，;；|]/),
    ...extra,
  ]
    .map((item) => item.trim())
    .filter((item) => item.length > 1 && item.length < 80);
  return Array.from(new Set(parts)).slice(0, 20);
}

export function safeRawText(doc: Document, max = 8000): string {
  try {
    return (doc.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  } catch {
    return '';
  }
}

export function looksLike(url: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(url));
}
