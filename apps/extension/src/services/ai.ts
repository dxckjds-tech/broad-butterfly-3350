import type {
  AiHealthPayload,
  CategoryCheckPayload,
  DescriptionOptimizePayload,
  GeoAnalysisPayload,
  KeywordOptimizePayload,
  ProductIdentityInspectPayload,
  TitleOptimizePayload,
  UniversalReasonPayload,
} from '@trade-ai/shared-types';
import { getApiBaseUrl } from '../utils/config';

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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readEnvelope<T>(res);
}

export async function fetchAiHealth(baseOverride?: string): Promise<AiHealthPayload> {
  const base = baseOverride || (await getApiBaseUrl());
  const res = await fetch(`${base}/ai/health`);
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
  identityUserVerified?: boolean;
}): Promise<TitleOptimizePayload> {
  return postJson<TitleOptimizePayload>('/ai/mic/optimize-title', input);
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
  identityUserVerified?: boolean;
}): Promise<KeywordOptimizePayload> {
  return postJson<KeywordOptimizePayload>('/ai/mic/optimize-keywords', input);
}

export async function inspectMicProductIdentity(input: {
  productName: string;
  category?: string;
  keywords?: string[];
  currentKeywords?: string[];
  centerTerms?: string[];
  specifications?: Record<string, string>;
  description?: string;
  certifications?: string[];
  url?: string;
  identityUserVerified?: boolean;
}): Promise<ProductIdentityInspectPayload> {
  return postJson<ProductIdentityInspectPayload>('/ai/mic/product-identity', input);
}

export async function confirmMicProductIdentity(input: {
  url: string;
  productName?: string;
  category?: string;
  keywords?: string[];
  userVerified?: boolean;
}): Promise<ProductIdentityInspectPayload> {
  return postJson<ProductIdentityInspectPayload>('/ai/mic/product-identity/confirm', input);
}

export async function checkMicCategory(input: {
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
}): Promise<CategoryCheckPayload> {
  return postJson<CategoryCheckPayload>('/ai/mic/category-check', input);
}

export async function optimizeMicDescription(input: {
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
}): Promise<DescriptionOptimizePayload> {
  return postJson<DescriptionOptimizePayload>('/ai/mic/optimize-description', input);
}

export async function analyzeMicGeo(input: {
  productName: string;
  companyName?: string;
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
}): Promise<GeoAnalysisPayload> {
  return postJson<GeoAnalysisPayload>('/ai/mic/geo-analysis', input);
}

export async function universalReasonMicProduct(input: {
  productName: string;
  category?: string;
  keywords?: string[];
  currentKeywords?: string[];
  centerTerms?: string[];
  specifications?: Record<string, string>;
  description?: string;
  certifications?: string[];
  url?: string;
  identityUserVerified?: boolean;
}): Promise<UniversalReasonPayload> {
  return postJson<UniversalReasonPayload>('/ai/mic/universal-reason', input);
}
