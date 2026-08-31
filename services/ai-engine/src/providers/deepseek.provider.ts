import type { PlatformPageData } from '@trade-ai/shared-types';
import type { AiRuntimeConfig } from '../config';
import { clientFromConfig, structuredFromChat, textFromChat } from '../http/openai-compat';
import type {
  GenerateStructuredInput,
  GenerateStructuredResult,
  GenerateTextInput,
  GenerateTextResult,
  HealthCheckResult,
  LLMProvider,
  LlmAnalyzeResult,
} from '../provider';

export class DeepSeekProvider implements LLMProvider {
  readonly name = 'deepseek';

  constructor(private readonly config: AiRuntimeConfig) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    return textFromChat(clientFromConfig(this.config, 'deepseek'), input, this.config.temperature);
  }

  async generateStructured(input: GenerateStructuredInput): Promise<GenerateStructuredResult> {
    return structuredFromChat(clientFromConfig(this.config, 'deepseek'), input, this.config.temperature);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    const model = this.config.deepseek.fastModel;
    try {
      await this.generateText({ prompt: 'Reply with OK only.', model });
      return {
        ok: true,
        provider: this.name,
        model,
        latencyMs: Date.now() - started,
        status: 'connected',
      };
    } catch (err) {
      return {
        ok: false,
        provider: this.name,
        model,
        latencyMs: Date.now() - started,
        status: 'unavailable',
        error: err instanceof Error ? err.message : 'unavailable',
      };
    }
  }

  async analyze(pageData: PlatformPageData): Promise<LlmAnalyzeResult> {
    const text = await this.generateText({
      prompt: `Summarize listing issues for: ${pageData.productName || pageData.title}`,
      model: this.config.deepseek.fastModel,
    });
    return { summary: text.text, suggestions: [] };
  }
}
