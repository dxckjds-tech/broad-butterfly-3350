import { MIC_DOM_CHANGED_MESSAGE } from './codes.js';

export interface ParserValidation {
  total: number;
  identified: number;
  failed: number;
  lowConfidence: number;
  fieldCompleteness: number;
  accuracy: number;
  abortBatch: boolean;
  message?: string;
  failures: Array<{ index: number; reason: string }>;
}

export function validateParserBatch(opts: {
  total: number;
  identified: number;
  failed: number;
  lowConfidence: number;
  fieldCompleteness: number;
  abortThreshold?: number;
}): ParserValidation {
  const accuracy = opts.total === 0 ? 1 : opts.identified / opts.total;
  const abortBatch = opts.total > 0 && accuracy < (opts.abortThreshold ?? 0.8);
  return {
    total: opts.total,
    identified: opts.identified,
    failed: opts.failed,
    lowConfidence: opts.lowConfidence,
    fieldCompleteness: opts.fieldCompleteness,
    accuracy,
    abortBatch,
    message: abortBatch ? MIC_DOM_CHANGED_MESSAGE : undefined,
    failures: [],
  };
}

const PRODUCT_FIELDS = ['name', 'status', 'productId', 'keywords', 'updatedAt', 'featured'] as const;
const INQUIRY_FIELDS = ['inquiryId', 'buyer', 'country', 'product', 'receivedAt', 'status', 'body'] as const;

export function sampleMatchRate(
  samples: Array<{ expected: Record<string, unknown>; actual: Record<string, unknown> }>,
  fields: readonly string[],
): { matchRate: number; compared: number; matched: number } {
  let compared = 0;
  let matched = 0;
  for (const s of samples) {
    for (const f of fields) {
      compared += 1;
      const a = String(s.expected[f] ?? '').trim();
      const b = String(s.actual[f] ?? '').trim();
      if (a && a === b) matched += 1;
      else if (!a && !b) matched += 1;
    }
  }
  return { matchRate: compared === 0 ? 1 : matched / compared, compared, matched };
}

export function classifyParsedRecords(
  items: Array<{ id?: string; name?: string; confidence?: number; failed?: boolean; reason?: string }>,
): { identified: number; failed: number; lowConfidence: number; completeness: number; failures: ParserValidation['failures'] } {
  let identified = 0;
  let failed = 0;
  let lowConfidence = 0;
  let filled = 0;
  let expected = 0;
  const failures: ParserValidation['failures'] = [];
  items.forEach((item, index) => {
    expected += 3;
    if (item.id) filled += 1;
    if (item.name) filled += 1;
    if ((item.confidence ?? 0) > 0) filled += 1;
    const ok = Boolean(item.id && item.name && (item.confidence ?? 0) >= 0.5 && !item.failed);
    if (ok) identified += 1;
    else {
      failed += 1;
      failures.push({ index, reason: item.reason || 'parse_failed' });
    }
    if (ok && (item.confidence ?? 1) < 0.7) lowConfidence += 1;
  });
  return {
    identified,
    failed,
    lowConfidence,
    completeness: expected === 0 ? 1 : filled / expected,
    failures,
  };
}

export const PRODUCT_COMPARE_FIELDS = PRODUCT_FIELDS;
export const INQUIRY_COMPARE_FIELDS = INQUIRY_FIELDS;
