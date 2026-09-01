export function applicationSuggestion(core?: string | null): string {
  const name = core ?? '该产品';
  return `建议用 2–4 句说明 ${name} 用在哪些行业或场景（例如住宅门窗、商业项目、配套主机厂），便于采购判断匹配度。`;
}
