import type { AiRuntimeConfig } from './config';
import { loadAiConfig } from './config';
import { MockLLMProvider } from './providers/mock.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { DeepSeekProvider } from './providers/deepseek.provider';
import type { LLMProvider } from './provider';

export class ClaudeProvider extends MockLLMProvider {
  override readonly name: string = 'claude';
}
export class GeminiProvider extends MockLLMProvider {
  override readonly name: string = 'gemini';
}
export class QwenProvider extends MockLLMProvider {
  override readonly name: string = 'qwen';
}

export function createLlmProvider(config: AiRuntimeConfig = loadAiConfig()): LLMProvider {
  switch (config.provider) {
    case 'deepseek':
      return new DeepSeekProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'claude':
      return new ClaudeProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'qwen':
      return new QwenProvider(config);
    default:
      return new MockLLMProvider(config);
  }
}
