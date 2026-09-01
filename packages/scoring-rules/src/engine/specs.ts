import type { PlatformPageData } from '@trade-ai/shared-types';

const WEAK = /model\s*no|trademark|origin|hs code|production capacity|transport package/i;
const MEANINGFUL =
  /material|size|power|capacity|dimension|weight|application|voltage|color|thickness|length|width|height|diameter|pressure|speed|moq|suction|tank|noise|cable|hose|motor|air\s*flow/i;

export function specEntries(page: PlatformPageData): Array<{ name: string; value: string }> {
  return Object.entries(page.specifications ?? {}).map(([name, value]) => ({ name, value }));
}

export function specificationStats(page: PlatformPageData): {
  total: number;
  meaningfulSpecificationCount: number;
  weakOnly: boolean;
} {
  const specs = specEntries(page);
  const fromDebug = page.specDebug;
  const meaningful =
    fromDebug?.meaningfulSpecificationCount ?? specs.filter((s) => MEANINGFUL.test(`${s.name} ${s.value}`)).length;
  const weak = specs.filter((s) => WEAK.test(s.name)).length;
  return {
    total: fromDebug?.rawSpecificationCount ?? specs.length,
    meaningfulSpecificationCount: meaningful,
    weakOnly: specs.length > 0 && meaningful === 0 && weak === specs.length,
  };
}
