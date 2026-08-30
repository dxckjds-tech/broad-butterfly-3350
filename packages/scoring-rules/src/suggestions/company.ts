export function companySuggestion(score: number): string {
  if (score <= 1) {
    return '建议补充工厂/制造商身份、年限、产能或认证等可验证信息，避免只写 we are a professional manufacturer。';
  }
  if (score <= 3) {
    return '已有基础企业信息。建议补充具体数字（人数、年产能、出口市场）或质检/研发说明。';
  }
  return '企业能力信息较完整，可核对数字与认证名称是否与店铺其他页面一致。';
}
