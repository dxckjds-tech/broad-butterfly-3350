export function descriptionSuggestion(wordCount: number, missingSections: string[]): string {
  const extra = missingSections.length
    ? `可优先补充：${missingSections.slice(0, 3).join('、')}。`
    : '可补充应用场景、参数解释和交期包装等采购决策信息。';
  if (wordCount < 80) {
    return `当前描述有效英文词偏少。建议写清产品是什么、关键规格、适用场景和定制能力，而不是重复营销套话。${extra}`;
  }
  return `建议把描述拆成清晰小节（规格、应用、包装、交期），减少空话，增加可验证事实。${extra}`;
}
