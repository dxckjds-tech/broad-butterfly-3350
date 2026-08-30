import type { PlatformPageData } from '@trade-ai/shared-types';
import { specEntries } from './specs';

export function evidenceCount(page: PlatformPageData, blob: string): number {
  let n = 0;
  if (specEntries(page).some((s) => /size|dimension|weight|material/i.test(s.name))) n += 1;
  if (/\b(iso|ce|rohs|sgs|test standard|astm)\b/i.test(blob)) n += 1;
  if (page.certifications?.length) n += 1;
  if (/\b\d+\s*(sets?|pcs|pieces|units|kg|mm|cm|mw|kw)\b/i.test(blob)) n += 1;
  if (page.moq?.trim()) n += 1;
  if (page.deliveryTime?.trim()) n += 1;
  if (/packag|carton|export case/i.test(blob)) n += 1;
  if (/employees|factory|annual output|production/i.test(blob)) n += 1;
  return n;
}
