import type { ParseDebugResult, PlatformPageData } from '@trade-ai/shared-types';
import { isParserDebugEnabled } from '../../debug';

export function buildProductEditDebug(page: PlatformPageData, extra: ParseDebugResult): ParseDebugResult | null {
  if (!isParserDebugEnabled()) return null;
  return extra;
}
