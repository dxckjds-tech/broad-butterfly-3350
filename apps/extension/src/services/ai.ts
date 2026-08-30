import type { AiHealthPayload, KeywordOptimizePayload, TitleOptimizePayload } from '@trade-ai/shared-types';
import { API_BASE_URL } from '../utils/config';

export const AI_UNAVAILABLE_COPY = 'AI服务暂时不可用，本地规则诊断仍然有效。';

async function readEnvelope<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { success?: boolean; data?: T; message?: string };
  if (!res.ok || json.success === false) {
    throw new Error(json.message || AI_UNAVAILABLE_COPY);
  }
  if (json.data === undefined) {
    throw new Error(AI_UNAVAILABLE_COPY);
  }
  return json.data;
}

export async function fetchAiHealth(): Promise<AiHealthPayload> {
  const res = await fetch(`${API_BASE_URL}/ai/health`);
  return readEnvelope<AiHealthPayload>(res);
}

export async function optimizeMicTitle(input: {
  productName: string;
  category?: string;
  keywords?: string[];
  centerTerms?: string[];
  specifications?: Record<string, string>;
  description?: string;
  certifications?: string[];
  url?: string;
  moq?: string;
  deliveryTime?: string;
}): Promise<TitleOptimizePayload> {
  const res = await fetch(`${API_BASE_URL}/ai/mic/optimize-title`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readEnvelope<TitleOptimizePayload>(res);
}

export async function optimizeMicKeywords(input: {
  productName: string;
  category?: string;
  keywords?: string[];
  currentKeywords?: string[];
  centerTerms?: string[];
  specifications?: Record<string, string>;
  description?: string;
  certifications?: string[];
  url?: string;
  moq?: string;
  deliveryTime?: string;
}): Promise<KeywordOptimizePayload> {
  const res = await fetch(`${API_BASE_URL}/ai/mic/optimize-keywords`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readEnvelope<KeywordOptimizePayload>(res);
}
