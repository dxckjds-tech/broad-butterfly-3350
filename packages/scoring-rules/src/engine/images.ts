import type { PlatformPageData } from '@trade-ai/shared-types';

export function imageStats(page: PlatformPageData): {
  uniqueCount: number;
  mainImageCount: number;
  detailImageCount: number;
  duplicateImageRatio: number;
} {
  const urls = page.images ?? [];
  const unique = [...new Set(urls)];
  const main = unique.filter((u) => /main|cover|thumb|0\./i.test(u) || unique.indexOf(u) === 0).length;
  return {
    uniqueCount: unique.length,
    mainImageCount: Math.min(main, unique.length),
    detailImageCount: Math.max(0, unique.length - 1),
    duplicateImageRatio: urls.length ? 1 - unique.length / urls.length : 0,
  };
}
