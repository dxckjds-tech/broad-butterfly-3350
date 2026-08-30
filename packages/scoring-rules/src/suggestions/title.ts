export function titleSuggestion(opts: {
  core?: string | null;
  wordCount: number;
  stuffing?: boolean;
  attributes?: number;
}): string {
  const core = opts.core ?? '核心产品词';
  if (opts.stuffing) {
    return `建议只保留一个中心产品词（例如 ${core}），去掉并列的其他产品名和营销词，再补充材质或适用场景。`;
  }
  if (opts.wordCount < 6) {
    return `建议保留核心产品词 ${core}，并补充材质和适用场景，例如 Aluminum Casement ${titleCase(core)} for Residential Windows。不要为了凑词堆叠多个产品中心词。`;
  }
  if (opts.wordCount > 18) {
    return `建议精简标题，围绕 ${core} 保留 2–3 个有效属性，去掉重复词和斜杠堆叠。`;
  }
  if ((opts.attributes ?? 0) < 2) {
    return `建议在保留 ${core} 的前提下补充材质、型号或应用场景，但不要堆叠多个产品中心词。`;
  }
  return `根据当前店铺运营与搜索表达建议，标题可围绕 ${core} 微调属性顺序，避免营销空话。`;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
