import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  AI_UNAVAILABLE_MESSAGE,
  AiUnavailableError,
  checkAiHealth,
  checkCategory,
  createLlmProvider,
  loadAiConfig,
  analyzeGeo,
  optimizeDescription,
  optimizeKeywords,
  optimizeTitle,
  type CategoryCheckResult,
  type DescriptionOptimizeResult,
  type GeoAnalyzeResult,
  type KeywordOptimizeResult,
  type LLMProvider,
  type TitleOptimizeResult,
} from '@trade-ai/ai-engine';
import { gateKeywordList, inspectProductIdentityWithGate, listingToPage } from '@trade-ai/scoring-rules';
import type {
  AiHealthPayload,
  GatedKeyword,
  ProductIdentityInspectPayload,
  ProductTruthProfile,
} from '@trade-ai/shared-types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import type { OptimizeTitleDto } from './dto/optimize-title.dto';
import type { ConfirmProductIdentityDto, KeywordGateDto } from './dto/product-identity.dto';

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
          companyName: dto.companyName,
          identityUserVerified: await this.resolveUserVerified(dto.url, dto.identityUserVerified),
        },
      });
      await this.persistTruthProfile(
        dto,
        result.productTruthProfile,
        result.identityConflict,
        result.keywordRecommendationsPaused,
      );
      await this.persistKeywordGate(dto.url, result.gatedKeywords);
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

  async checkMicCategory(dto: OptimizeTitleDto): Promise<CategoryCheckResult> {
    const started = Date.now();
    try {
      const result = await checkCategory({
        provider: this.provider,
        config: this.config,
        input: {
          productName: dto.productName,
          category: dto.category,
          keywords: dto.keywords ?? dto.currentKeywords ?? [],
          currentKeywords: dto.currentKeywords ?? dto.keywords ?? [],
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
        taskType: 'CATEGORY_CHECK',
        provider: this.provider.name,
        model: this.config.deepseek.proModel,
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
      this.logger.warn(`AI category check failed: ${err instanceof Error ? err.message : 'unknown'}`);
      throw new HttpException(
        { message: AI_UNAVAILABLE_MESSAGE, code: 'AI_UNAVAILABLE' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async optimizeMicDescription(dto: OptimizeTitleDto): Promise<DescriptionOptimizeResult> {
    const started = Date.now();
    try {
      const result = await optimizeDescription({
        provider: this.provider,
        config: this.config,
        input: {
          productName: dto.productName,
          category: dto.category,
          keywords: dto.keywords ?? dto.currentKeywords ?? [],
          currentKeywords: dto.currentKeywords ?? dto.keywords ?? [],
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
        taskType: 'DESCRIPTION_OPTIMIZATION',
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
      this.logger.warn(`AI description optimize failed: ${err instanceof Error ? err.message : 'unknown'}`);
      throw new HttpException(
        { message: AI_UNAVAILABLE_MESSAGE, code: 'AI_UNAVAILABLE' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async analyzeMicGeo(dto: OptimizeTitleDto): Promise<GeoAnalyzeResult> {
    const started = Date.now();
    try {
      const result = await analyzeGeo({
        provider: this.provider,
        config: this.config,
        input: {
          productName: dto.productName,
          companyName: dto.companyName,
          category: dto.category,
          keywords: dto.keywords ?? dto.currentKeywords ?? [],
          currentKeywords: dto.currentKeywords ?? dto.keywords ?? [],
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
        taskType: 'GEO_DEEP_ANALYSIS',
        provider: this.provider.name,
        model: this.config.deepseek.proModel,
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
      this.logger.warn(`AI GEO analysis failed: ${err instanceof Error ? err.message : 'unknown'}`);
      throw new HttpException(
        { message: AI_UNAVAILABLE_MESSAGE, code: 'AI_UNAVAILABLE' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async inspectProductIdentity(dto: OptimizeTitleDto): Promise<ProductIdentityInspectPayload> {
    const userVerified = await this.resolveUserVerified(dto.url, dto.identityUserVerified);
    const page = listingToPage({
      productName: dto.productName,
      category: dto.category,
      keywords: dto.keywords ?? dto.currentKeywords ?? [],
      currentKeywords: dto.currentKeywords ?? dto.keywords ?? [],
      centerTerms: dto.centerTerms,
      specifications: dto.specifications,
      description: dto.description,
      certifications: dto.certifications,
      url: dto.url,
      moq: dto.moq,
      deliveryTime: dto.deliveryTime,
      companyName: dto.companyName,
      identityUserVerified: userVerified,
    });
    const inspect = inspectProductIdentityWithGate(page);
    await this.persistTruthProfile(dto, inspect.profile, inspect.conflict, inspect.keywordRecommendationsPaused);
    await this.persistKeywordGate(dto.url, inspect.currentKeywordGate);
    return inspect;
  }

  async confirmProductIdentity(dto: ConfirmProductIdentityDto): Promise<ProductIdentityInspectPayload> {
    if (!dto.url?.trim()) {
      throw new HttpException({ message: '缺少页面 URL，无法确认产品身份。', code: 'IDENTITY_URL_REQUIRED' }, HttpStatus.BAD_REQUEST);
    }
    const stored = await this.readStoredProfile(dto.url);
    const productName = dto.productName || stored?.coreProduct;
    if (!productName) {
      throw new HttpException({ message: '缺少产品标题，无法确认产品身份。', code: 'IDENTITY_TITLE_REQUIRED' }, HttpStatus.BAD_REQUEST);
    }
    const inspect = inspectProductIdentityWithGate(
      listingToPage({
        productName,
        category: dto.category,
        keywords: dto.keywords ?? [],
        url: dto.url,
        identityUserVerified: true,
      }),
    );
    const frozen: ProductTruthProfile = stored?.userVerified
      ? {
          ...inspect.profile,
          coreProduct: stored.coreProduct,
          productFamily: stored.productFamily,
          productType: stored.productType,
          userVerified: true,
          identityConfidence: 1,
        }
      : { ...inspect.profile, userVerified: true, identityConfidence: 1 };
    const paused = false;
    const conflict = inspect.conflict
      ? { ...inspect.conflict, keywordRecommendationsPaused: false }
      : null;
    await this.persistTruthProfile(
      { productName, url: dto.url },
      frozen,
      conflict,
      paused,
      { forceVerified: true },
    );
    return {
      profile: frozen,
      conflict,
      keywordRecommendationsPaused: false,
      currentKeywordGate: inspect.currentKeywordGate,
      blockedKeywords: inspect.blockedKeywords,
    };
  }

  async gateKeywords(dto: KeywordGateDto): Promise<{
    gatedKeywords: GatedKeyword[];
    blockedKeywords: ProductIdentityInspectPayload['blockedKeywords'];
    officialTop3: GatedKeyword[];
    searchDemand: 'UNKNOWN';
    productTruthProfile: ProductTruthProfile;
    identityConflict: ProductIdentityInspectPayload['conflict'];
    keywordRecommendationsPaused: boolean;
  }> {
    const userVerified = await this.resolveUserVerified(dto.url, dto.identityUserVerified);
    const page = listingToPage({
      productName: dto.productName,
      category: dto.category,
      keywords: dto.keywords ?? dto.currentKeywords ?? [],
      currentKeywords: dto.currentKeywords ?? dto.keywords ?? [],
      centerTerms: dto.centerTerms,
      specifications: dto.specifications,
      description: dto.description,
      certifications: dto.certifications,
      url: dto.url,
      moq: dto.moq,
      deliveryTime: dto.deliveryTime,
      companyName: dto.companyName,
      identityUserVerified: userVerified,
    });
    const inspect = inspectProductIdentityWithGate(page);
    const phrases = (dto.gateKeywords ?? page.keywords).filter(Boolean);
    const gated = gateKeywordList(phrases, page, inspect.profile);
    await this.persistTruthProfile(dto, inspect.profile, inspect.conflict, inspect.keywordRecommendationsPaused);
    await this.persistKeywordGate(dto.url, gated.gated);
    return {
      gatedKeywords: gated.gated,
      blockedKeywords: gated.blocked,
      officialTop3: [],
      searchDemand: 'UNKNOWN',
      productTruthProfile: inspect.profile,
      identityConflict: inspect.conflict,
      keywordRecommendationsPaused: inspect.keywordRecommendationsPaused,
    };
  }

  private async resolveUserVerified(url?: string, claimed?: boolean): Promise<boolean> {
    if (claimed) return true;
    const stored = url ? await this.readStoredProfile(url) : null;
    return Boolean(stored?.userVerified);
  }

  private async readStoredProfile(url: string): Promise<{
    userVerified: boolean;
    coreProduct: string;
    productFamily: string;
    productType: string;
  } | null> {
    if (!url) return null;
    try {
      const row = await this.prisma.productTruthProfile.findUnique({ where: { pageUrl: url } });
      if (!row) return null;
      return {
        userVerified: row.userVerified,
        coreProduct: row.coreProduct,
        productFamily: row.productFamily,
        productType: row.productType,
      };
    } catch (err) {
      this.logger.warn(`ProductTruthProfile read skipped: ${err instanceof Error ? err.message : 'unknown'}`);
      return null;
    }
  }

  private async persistTruthProfile(
    dto: Pick<OptimizeTitleDto, 'url' | 'productName'>,
    profile: ProductTruthProfile,
    conflict: ProductIdentityInspectPayload['conflict'],
    paused: boolean,
    opts?: { forceVerified?: boolean },
  ): Promise<void> {
    const pageUrl = dto.url?.trim();
    if (!pageUrl) return;
    try {
      const existing = await this.prisma.productTruthProfile.findUnique({ where: { pageUrl } });
      const verified = Boolean(opts?.forceVerified || existing?.userVerified || profile.userVerified);
      const frozenCore = existing?.userVerified
        ? {
            coreProduct: existing.coreProduct,
            productFamily: existing.productFamily,
            productType: existing.productType,
          }
        : {
            coreProduct: profile.coreProduct,
            productFamily: profile.productFamily,
            productType: profile.productType,
          };
      const data = {
        productId: null,
        ...frozenCore,
        verifiedAttributes: profile.verifiedAttributes as Prisma.InputJsonValue,
        specifications: profile.specifications as Prisma.InputJsonValue,
        applications: profile.applications as Prisma.InputJsonValue,
        materials: profile.materials as Prisma.InputJsonValue,
        certifications: profile.certifications as Prisma.InputJsonValue,
        capabilities: profile.capabilities as Prisma.InputJsonValue,
        unverifiedClaims: profile.unverifiedClaims as Prisma.InputJsonValue,
        conflictingClaims: profile.conflictingClaims as Prisma.InputJsonValue,
        evidence: profile.evidence as unknown as Prisma.InputJsonValue,
        identityConfidence: verified ? 1 : profile.identityConfidence,
        userVerified: verified,
        identityConflict: (conflict ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        keywordRecommendationsPaused: verified ? false : paused,
        confirmedAt: verified ? existing?.confirmedAt ?? new Date() : null,
      };
      await this.prisma.productTruthProfile.upsert({
        where: { pageUrl },
        create: { pageUrl, ...data },
        update: existing?.userVerified && !opts?.forceVerified
          ? {
              specifications: data.specifications,
              applications: data.applications,
              materials: data.materials,
              certifications: data.certifications,
              evidence: data.evidence,
              unverifiedClaims: data.unverifiedClaims,
              conflictingClaims: data.conflictingClaims,
              identityConflict: data.identityConflict,
              keywordRecommendationsPaused: false,
              userVerified: true,
              identityConfidence: 1,
            }
          : data,
      });
    } catch (err) {
      this.logger.warn(`ProductTruthProfile persist skipped: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  private async persistKeywordGate(pageUrl: string | undefined, gated: GatedKeyword[]): Promise<void> {
    if (!pageUrl?.trim() || !gated.length) return;
    try {
      await this.prisma.keywordGateLog.createMany({
        data: gated.slice(0, 40).map((row) => ({
          pageUrl,
          keyword: row.keyword,
          matchScore: row.matchScore,
          status: row.status,
          blockedReasons: row.blockedReasons as Prisma.InputJsonValue,
          demand: row.searchEvidence.demand === 'UNKNOWN' ? 'UNKNOWN' : String(row.searchEvidence.demand),
        })),
      });
    } catch (err) {
      this.logger.warn(`KeywordGateLog persist skipped: ${err instanceof Error ? err.message : 'unknown'}`);
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
