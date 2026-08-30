import type { PlatformPageData } from '@trade-ai/shared-types';

export interface GenerateTextInput {
  prompt: string;
  system?: string;
}

export interface LlmAnalyzeResult {
  summary: string;
  suggestions: string[];
}

export interface LLMProvider {
  readonly name: string;
  generateText(input: GenerateTextInput): Promise<string>;
  analyze(pageData: PlatformPageData): Promise<LlmAnalyzeResult>;
}
