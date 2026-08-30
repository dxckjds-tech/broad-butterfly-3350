export function specificationSuggestion(total: number, meaningful: number): string {
  if (total === 0) {
    return '建议补充材料、尺寸、重量、适用范围等采购决策相关参数，而不是只填 Model NO.、Trademark、Origin。';
  }
  if (meaningful < 3) {
    return `当前识别到 ${total} 项参数，但有效产品参数约 ${meaningful} 项。建议补充 Material、Size、Weight、Application 等买家会用来对比的字段。`;
  }
  return '参数已较完整，可继续核对单位与数值是否准确、是否覆盖核心采购属性。';
}
