import { Inject, Injectable, Logger } from '@nestjs/common';
import { diagnosePage } from '@trade-ai/diagnosis-engine';
import type { DashboardStats, DiagnosisResult, PlatformPageData } from '@trade-ai/shared-types';
import { PrismaService } from '../../common/prisma.service';

const SYSTEM_EMAIL = 'system@trade-ai-doctor.local';

@Injectable()
export class DiagnosisService {
  private readonly logger = new Logger(DiagnosisService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async diagnoseAndPersist(page: PlatformPageData): Promise<DiagnosisResult> {
    this.logger.log(`Diagnosis start platform=${page.platform} type=${page.pageType} url=${page.url}`);
    const output = await diagnosePage(page);
    const { result } = output;

    const user = await this.prisma.user.upsert({
      where: { email: SYSTEM_EMAIL },
      update: {},
      create: { email: SYSTEM_EMAIL, name: 'System' },
    });

    const shopUrl = this.deriveShopUrl(page);
    const companyName = page.companyName.trim() || 'Unknown Company';

    let shop = await this.prisma.shop.findFirst({
      where: { userId: user.id, platform: String(page.platform), shopUrl },
    });
    if (!shop) {
      shop = await this.prisma.shop.create({
        data: {
          userId: user.id,
          platform: String(page.platform),
          companyName,
          shopUrl,
        },
      });
    } else if (shop.companyName !== companyName && page.companyName.trim()) {
      shop = await this.prisma.shop.update({
        where: { id: shop.id },
        data: { companyName },
      });
    }

    let productId: string | null = null;
    if ((page.pageType === 'PRODUCT' || page.pageType === 'MIC_PRODUCT_EDIT') && page.url) {
      const existing = await this.prisma.product.findFirst({
        where: { shopId: shop.id, url: page.url },
      });
      const product = existing
        ? await this.prisma.product.update({
            where: { id: existing.id },
            data: {
              name: page.productName || page.title || 'Untitled product',
              category: page.category || null,
            },
          })
        : await this.prisma.product.create({
            data: {
              shopId: shop.id,
              platformProductId: this.extractProductId(page.url),
              name: page.productName || page.title || 'Untitled product',
              url: page.url,
              category: page.category || null,
            },
          });
      productId = product.id;
    }

    const report = await this.prisma.diagnosisReport.create({
      data: {
        shopId: shop.id,
        productId,
        pageUrl: page.url,
        pageType: page.pageType,
        totalScore: result.totalScore,
        rawPageData: page as object,
        score: {
          create: {
            micSeo: result.scores.micSeo,
            googleSeo: result.scores.googleSeo,
            geo: result.scores.geo,
            contentQuality: result.scores.contentQuality,
            b2bConversion: result.scores.b2bConversion,
            compliance: result.scores.compliance ?? null,
          },
        },
        issues: {
          create: result.issues.map((issue) => ({
            category: issue.category,
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            suggestion: issue.suggestion,
            scoreImpact: issue.scoreImpact,
          })),
        },
      },
    });

    await this.prisma.shop.update({
      where: { id: shop.id },
      data: { lastDiagnosisAt: new Date() },
    });

    this.logger.log(
      `Diagnosis saved id=${report.id} total=${result.totalScore} issues=${result.issues.length}`,
    );

    return {
      diagnosisId: report.id,
      totalScore: result.totalScore,
      scores: result.scores,
      issues: result.issues,
    };
  }

  async stats(): Promise<DashboardStats> {
    const [shopCount, productCount, reports, criticalIssueCount] = await Promise.all([
      this.prisma.shop.count(),
      this.prisma.product.count(),
      this.prisma.diagnosisReport.findMany({
        include: { score: true },
      }),
      this.prisma.diagnosisIssue.count({ where: { severity: 'CRITICAL' } }),
    ]);

    const avg = (values: number[]) =>
      values.length === 0 ? 0 : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

    return {
      shopCount,
      productCount,
      averageHealth: avg(reports.map((item) => item.totalScore)),
      criticalIssueCount,
      averageMicSeo: avg(reports.map((item) => item.score?.micSeo ?? 0).filter(Boolean)),
      averageGeo: avg(reports.map((item) => item.score?.geo ?? 0).filter(Boolean)),
    };
  }

  async listReports() {
    return this.prisma.diagnosisReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { score: true, shop: true, product: true, issues: true },
    });
  }

  private deriveShopUrl(page: PlatformPageData): string {
    try {
      const url = new URL(page.url);
      return `${url.origin}/`;
    } catch {
      return page.url || 'unknown';
    }
  }

  private extractProductId(url: string): string | null {
    const match = url.match(/(\d{6,})/);
    return match?.[1] ?? null;
  }
}
