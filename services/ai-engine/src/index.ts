import { prompts } from '@trade-ai/prompts';
import type { AiRuntimeConfig } from './config';
import { loadAiConfig } from './config';
import { createLlmProvider } from './factory';
import { AI_ENGINE_VERSION } from './provider';
import type { HealthCheckResult, LLMProvider } from './provider';

export async function checkAiHealth(
  provider: LLMProvider = createLlmProvider(),
  config: AiRuntimeConfig = loadAiConfig(),
): Promise<
  HealthCheckResult & {
    requestedProvider: string;
    engineVersion: string;
    fallbackReason?: string;
  }
> {
  const result = await provider.healthCheck();
  return {
    ...result,
    requestedProvider: config.requestedProvider,
    engineVersion: AI_ENGINE_VERSION,
    fallbackReason: config.fallbackReason,
  };
}

export function systemPrompt(): string {
  return prompts.diagnosis;
}

export { AI_ENGINE_VERSION, AI_UNAVAILABLE_MESSAGE, ENABLED_AI_TASKS } from './provider';
export type {
  AiCallLogRecord,
  AiTaskType,
  GenerateStructuredInput,
  GenerateStructuredResult,
  GenerateTextInput,
  GenerateTextResult,
  HealthCheckResult,
  LLMProvider,
  LlmAnalyzeResult,
} from './provider';
export { loadAiConfig } from './config';
export type { AiRuntimeConfig } from './config';
export { routeModel } from './model-router';
export { createLlmProvider, ClaudeProvider, GeminiProvider, QwenProvider } from './factory';
export { MockLLMProvider } from './providers/mock.provider';
export { OpenAIProvider } from './providers/openai.provider';
export { DeepSeekProvider } from './providers/deepseek.provider';
export { optimizeTitle, AiUnavailableError } from './tasks/optimize-title';
export type { TitleOptimizeInput, TitleOptimizeResult } from './tasks/optimize-title';
export { optimizeKeywords } from './tasks/optimize-keywords';
export type { KeywordOptimizeInput, KeywordOptimizeResult } from './tasks/optimize-keywords';
export { checkCategory } from './tasks/check-category';
export type { CategoryCheckInput, CategoryCheckResult } from './tasks/check-category';
export { optimizeDescription } from './tasks/optimize-description';
export type { DescriptionOptimizeInput, DescriptionOptimizeResult } from './tasks/optimize-description';
export { applyFactGuard } from './fact-guard';
export { clearAiCache } from './cache';
export { TitleOptimizeOutputSchema } from './schemas/title';
export { KeywordOptimizeOutputSchema } from './schemas/keyword';
export { CategoryCheckOutputSchema } from './schemas/category';
export { DescriptionOptimizeOutputSchema } from './schemas/description';
