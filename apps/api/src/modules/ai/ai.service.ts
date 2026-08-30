import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  AI_UNAVAILABLE_MESSAGE,
  AiUnavailableError,
  checkAiHealth,
  createLlmProvider,
  loadAiConfig,
  optimizeKeywords,
  optimizeTitle,
  type KeywordOptimizeResult,
  type LLMProvider,
  type TitleOptimizeResult,
} from '@trade-ai/ai-engine';
import type { AiHealthPayload } from '@trade-ai/shared-types';
import { PrismaService } from '../../common/prisma.service';
import type { OptimizeTitleDto } from './dto/optimize-title.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly config = loadAiConfig();
  private readonly provider: LLMProvider = createLlmProvider(this.config);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async health(): Promise<AiHealthPayload> {
    const result = await checkAiHealth(this.provider, this.config);
    this.logger.log(
      `AI health provider=${result.provider} model=${result.model} status=${result.status} latency=${result.latencyMs}`,
    );
    return {
      provider: result.provider,
      model: result.model,
      status: result.status,
      latency: result.latencyMs,
    };
  }

  async optimizeMicTitle(dto: OptimizeTitleDto): Promise<TitleOptimizeResult> {
    const started = Date.now();
    try {
      const result = await optimizeTitle({
        provider: this.provider,
        config: this.config,
        input: {
          productName: dto.productName,
          category: dto.category,
          keywords: dto.keywords ?? dto.currentKeywords ?? [],
          centerTerms: dto.centerTerms,
          specifications: dto.specifications,
          description: dto.description,
          certifications: dto.certifications,
          url: dto.url,
          moq: dto.moq,
          deliveryTime: dto.deliveryTime,
        },
      });
      await this.logCall({
        taskType: result.meta.taskType,
        provider: result.meta.provider,
        model: result.meta.model,
        latency: result.meta.latency,
        inputTokens: result.meta.inputTokens,
        outputTokens: result.meta.outputTokens,
        status: result.meta.status,
        pageUrl: dto.url,
      });
      return result;
    } catch (err) {
      await this.logCall({
        taskType: 'TITLE_OPTIMIZATION',
        provider: this.provider.name,
        model: this.config.deepseek.fastModel,
        latency: Date.now() - started,
        inputTokens: null,
        outputTokens: null,
        status: 'error',
        pageUrl: dto.url,
      });
      if (err instanceof AiUnavailableError) {
        throw new HttpException(
          { message: err.message, code: 'AI_UNAVAILABLE' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      this.logger.warn(`AI title optimize failed: ${err instanceof Error ? err.message : 'unknown'}`);
      throw new HttpException(
        { message: AI_UNAVAILABLE_MESSAGE, code: 'AI_UNAVAILABLE' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async optimizeMicKeywords(dto: OptimizeTitleDto): Promise<KeywordOptimizeResult> {
    const started = Date.now();
    try {
      const result = await optimizeKeywords({
        provider: this.provider,
        config: this.config,
        input: {
          productName: dto.productName,
          category: dto.category,
          currentKeywords: dto.currentKeywords ?? dto.keywords ?? [],
          keywords: dto.keywords,
          centerTerms: dto.centerTerms,
          specifications: dto.specifications,
          description: dto.description,
          certifications: dto.certifications,
          url: dto.url,
          moq: dto.moq,
          deliveryTime: dto.deliveryTime,
        },
      });
      await this.logCall({
        taskType: result.meta.taskType,
        provider: result.meta.provider,
        model: result.meta.model,
        latency: result.meta.latency,
        inputTokens: result.meta.inputTokens,
        outputTokens: result.meta.outputTokens,
        status: result.meta.status,
        pageUrl: dto.url,
      });
      return result;
    } catch (err) {
      await this.logCall({
        taskType: 'KEYWORD_OPTIMIZATION',
        provider: this.provider.name,
        model: this.config.deepseek.fastModel,
        latency: Date.now() - started,
        inputTokens: null,
        outputTokens: null,
        status: 'error',
        pageUrl: dto.url,
      });
      if (err instanceof AiUnavailableError) {
        throw new HttpException(
          { message: err.message, code: 'AI_UNAVAILABLE' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      this.logger.warn(`AI keyword optimize failed: ${err instanceof Error ? err.message : 'unknown'}`);
      throw new HttpException(
        { message: AI_UNAVAILABLE_MESSAGE, code: 'AI_UNAVAILABLE' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async logCall(entry: {
    taskType: string;
    provider: string;
    model: string;
    latency: number;
    inputTokens: number | null;
    outputTokens: number | null;
    status: string;
    pageUrl?: string;
  }): Promise<void> {
    try {
      await this.prisma.aiCallLog.create({
        data: {
          taskType: entry.taskType,
          provider: entry.provider,
          model: entry.model,
          latency: entry.latency,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          status: entry.status,
          pageUrl: entry.pageUrl,
        },
      });
    } catch (err) {
      this.logger.warn(`AiCallLog persist skipped: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
}
