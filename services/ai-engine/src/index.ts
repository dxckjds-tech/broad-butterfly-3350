import { prompts } from '@trade-ai/prompts';
import type { PlatformPageData } from '@trade-ai/shared-types';
import type { GenerateTextInput, LLMProvider, LlmAnalyzeResult } from './provider';

export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';

  async generateText(input: GenerateTextInput): Promise<string> {
    return `[mock:${this.name}] ${input.prompt.slice(0, 80)}`;
  }

  async analyze(pageData: PlatformPageData): Promise<LlmAnalyzeResult> {
    return {
      summary: `Mock analysis for ${pageData.productName || pageData.title || 'unknown page'}. Provider=${this.name}.`,
      suggestions: [
        'Clarify the product focus keyword in the title.',
        'Add structured specifications and OEM capability.',
        'Publish FAQ and application scenarios for GEO.',
      ],
    };
  }
}

export class OpenAIProvider extends MockLLMProvider {
  readonly name = 'openai';
}
export class ClaudeProvider extends MockLLMProvider {
  readonly name = 'claude';
}
export class GeminiProvider extends MockLLMProvider {
  readonly name = 'gemini';
}
export class DeepSeekProvider extends MockLLMProvider {
  readonly name = 'deepseek';
}
export class QwenProvider extends MockLLMProvider {
  readonly name = 'qwen';
}

export function createLlmProvider(name = process.env.LLM_PROVIDER ?? 'mock'): LLMProvider {
  switch (name) {
    case 'openai':
      return new OpenAIProvider();
    case 'claude':
    case 'anthropic':
      return new ClaudeProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'deepseek':
      return new DeepSeekProvider();
    case 'qwen':
      return new QwenProvider();
    default:
      return new MockLLMProvider();
  }
}

export function systemPrompt(): string {
  return prompts.diagnosis;
}
