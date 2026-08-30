import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ShopSummary } from '@trade-ai/shared-types';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ShopsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listSummaries(): Promise<ShopSummary[]> {
    const shops = await this.prisma.shop.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { score: true },
        },
      },
    });

    return shops.map((shop) => {
      const latest = shop.reports[0];
      return {
        id: shop.id,
        companyName: shop.companyName,
        platform: shop.platform,
        shopUrl: shop.shopUrl,
        totalScore: latest?.totalScore ?? null,
        micSeo: latest?.score?.micSeo ?? null,
        googleSeo: latest?.score?.googleSeo ?? null,
        geo: latest?.score?.geo ?? null,
        lastDiagnosisAt: shop.lastDiagnosisAt?.toISOString() ?? null,
      };
    });
  }

  async getById(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: { products: true, reports: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }
}
