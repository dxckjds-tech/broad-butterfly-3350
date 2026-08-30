import {
  PARSE_QUALITY_FIELDS,
  PARSE_QUALITY_WEIGHTS,
  type FieldStatus,
  type FieldStatusMap,
  type ParseQuality,
  type ParseQualityField,
} from '@trade-ai/shared-types';

const LOW_CONFIDENCE = 45;

export function computeParseQuality(status: FieldStatusMap, warnings: string[] = []): ParseQuality {
  let earned = 0;
  let total = 0;
  const foundFields: string[] = [];
  const missingFields: string[] = [];

  for (const field of PARSE_QUALITY_FIELDS) {
    const weight = PARSE_QUALITY_WEIGHTS[field];
    total += weight;
    const state = status[field] ?? 'MISSING';
    if (state === 'FOUND') {
      earned += weight;
      foundFields.push(field);
    } else if (state === 'UNCERTAIN') {
      earned += weight * 0.5;
      missingFields.push(field);
    } else {
      missingFields.push(field);
    }
  }

  const score = total === 0 ? 0 : Math.max(0, Math.min(100, Math.round((earned / total) * 100)));
  return { score, foundFields, missingFields, warnings };
}

export function isLowParseConfidence(quality: ParseQuality | undefined): boolean {
  return (quality?.score ?? 0) < LOW_CONFIDENCE;
}

export function statusForValue(
  found: boolean,
  opts: { uncertain?: boolean } = {},
): FieldStatus {
  if (opts.uncertain) return 'UNCERTAIN';
  return found ? 'FOUND' : 'MISSING';
}

export function downgradeMissingWhenUncertain(
  status: FieldStatusMap,
  quality: ParseQuality,
): FieldStatusMap {
  if (!isLowParseConfidence(quality)) return status;
  const next: FieldStatusMap = { ...status };
  for (const field of PARSE_QUALITY_FIELDS) {
    if ((next[field] ?? 'MISSING') === 'MISSING') {
      next[field] = 'UNCERTAIN';
    }
  }
  return next;
}

export function fieldLabel(field: ParseQualityField | string): string {
  const labels: Record<string, string> = {
    productName: '标题',
    companyName: '公司',
    description: '描述',
    images: '图片',
    specifications: '规格',
    moq: 'MOQ',
    deliveryTime: '交期',
    oemAvailable: 'OEM',
    certifications: '认证',
    category: '类目',
    keywords: '关键词',
  };
  return labels[field] ?? field;
}
