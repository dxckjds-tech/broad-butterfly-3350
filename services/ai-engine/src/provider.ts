import type { PlatformPageData } from '@trade-ai/shared-types';

export const AI_ENGINE_VERSION = 'AI_ENGINE_1.1.6';
export const AI_UNAVAILABLE_MESSAGE = 'AI服务暂时不可用，本地规则诊断仍然有效。';

export const ENABLED_AI_TASKS = new Set([
  'TITLE_OPTIMIZATION',
  'KEYWORD_OPTIMIZATION',
  'CATEGORY_CHECK',
  'DESCRIPTION_OPTIMIZATION',
  'GEO_DEEP_ANALYSIS',
] as const);

export interface GenerateTextInput {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  json?: boolean;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  usage: LlmUsage;
}

export interface GenerateStructuredInput {
  prompt: string;
  system?: string;
  model?: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  temperature?: number;
}

export interface GenerateStructuredResult {
  data: unknown;
  raw: string;
  model: string;
  usage: LlmUsage;
  repaired: boolean;
}

export interface LlmAnalyzeResult {
  summary: string;
  suggestions: string[];
}

export type AiHealthStatus = 'connected' | 'unavailable' | 'mock';

export interface HealthCheckResult {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  status: AiHealthStatus;
  error?: string;
}

export interface LLMProvider {
  readonly name: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateStructured(input: GenerateStructuredInput): Promise<GenerateStructuredResult>;
  healthCheck(): Promise<HealthCheckResult>;
  analyze(pageData: PlatformPageData): Promise<LlmAnalyzeResult>;
}

export type AiTaskType =
  | 'TITLE_OPTIMIZATION'
  | 'KEYWORD_OPTIMIZATION'
  | 'DESCRIPTION_OPTIMIZATION'
  | 'FAQ_GENERATION'
  | 'BUYER_INTENT'
  | 'CATEGORY_CHECK'
  | 'GEO_DEEP_ANALYSIS'
  | 'DEEP_DIAGNOSIS'
  | 'OPERATIONS_PLANNER';

export interface AiCallLogRecord {
  taskType: string;
  provider: string;
  model: string;
  latency: number;
  inputTokens: number | null;
  outputTokens: number | null;
  status: 'ok' | 'error' | 'fallback' | 'cached';
  createdAt: string;
}
