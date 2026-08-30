export function oemSuggestion(relevant: boolean): string {
  if (relevant) {
    return '该类目买家通常关注定制能力。建议写明 OEM/ODM 范围、MOQ、可改 Logo/包装/尺寸，以及打样周期。';
  }
  return '标准品可简要说明是否支持贴牌或配件定制；不必写成完整定制工厂介绍。';
}
