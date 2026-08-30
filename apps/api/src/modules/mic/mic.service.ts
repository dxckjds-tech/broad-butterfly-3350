import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  analyzeInquiry,
  businessPriorityScore,
  draftInquiryReply,
  draftQuote,
  finalizeJobStatus,
  matchRfqToProducts,
} from '@trade-ai/inquiry-engine';
import { assertNoSecrets } from '@trade-ai/platform-adapters';
import type { MICVirtualOfficeData } from '@trade-ai/shared-types';
import { PrismaService } from '../../common/prisma.service';

const SYSTEM_EMAIL = 'system@trade-ai-doctor.local';

@Injectable()
export class MicService {
  private readonly logger = new Logger(MicService.name);

  constructor(private readonly prisma: PrismaService) {}

  async connectionStatus() {
    const conn = await this.prisma.micAccountConnection.findFirst({ orderBy: { updatedAt: 'desc' } });
    return {
      mode: 'BROWSER_SESSION',
      integration: 'MIC_INTEGRATION_2.0.0',
      passwordStored: false,
      cookieUploaded: false,
      smsStored: false,
      accountLabel: conn?.accountLabel ?? null,
      lastSyncAt: conn?.lastSyncAt?.toISOString() ?? null,
      inquiryRetentionDays: conn?.inquiryRetentionDays ?? 90,
      note: 'MIC 登录由浏览器插件管理。系统不会保存 MIC 密码或 Cookie Value。',
    };
  }

  async sync(payload: MICVirtualOfficeData & { shopId?: string }) {
    assertNoSecrets(payload);
    this.logger.log(`sync started modules=${payload.syncMeta.modules.map((m) => m.module + ':' + m.status).join(',')}`);

    const shop = await this.ensureShop(payload);
    const job = await this.prisma.micSyncJob.create({
      data: {
        shopId: shop.id,
        modules: payload.syncMeta.modules.map((m) => ({ module: m.module, status: m.status, count: m.records.length })),
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      await this.prisma.micAccountConnection.upsert({
        where: { shopId: shop.id },
        update: {
          accountLabel: payload.account.accountLabel,
          accountType: payload.account.accountType,
          permissions: payload.account.permissions,
          lastLoginDetectedAt: new Date(payload.account.lastLoginDetectedAt),
          lastSyncAt: new Date(),
        },
        create: {
          shopId: shop.id,
          accountLabel: payload.account.accountLabel,
          accountType: payload.account.accountType,
          permissions: payload.account.permissions,
          lastLoginDetectedAt: new Date(payload.account.lastLoginDetectedAt),
          lastSyncAt: new Date(),
        },
      });

      for (const p of payload.products) {
        await this.prisma.micProductRecord.upsert({
          where: { shopId_micProductId: { shopId: shop.id, micProductId: p.micProductId } },
          update: {
            productName: p.productName,
            productUrl: p.productUrl,
            model: p.model,
            category: p.category,
            status: p.status,
            keywords: p.keywords,
            isFeaturedProduct: p.isFeaturedProduct,
            featuredScore: p.featuredScore,
            rawSourceHash: p.rawSourceHash,
            idConfidence: p.idConfidence,
            syncedAt: new Date(p.syncedAt),
          },
          create: {
            shopId: shop.id,
            micProductId: p.micProductId,
            productName: p.productName,
            productUrl: p.productUrl,
            model: p.model,
            category: p.category,
            status: p.status,
            keywords: p.keywords,
            isFeaturedProduct: p.isFeaturedProduct,
            featuredScore: p.featuredScore,
            rawSourceHash: p.rawSourceHash,
            idConfidence: p.idConfidence,
            syncedAt: new Date(p.syncedAt),
          },
        });
        if (p.productUrl) {
          const existing = await this.prisma.product.findFirst({ where: { shopId: shop.id, url: p.productUrl } });
          if (!existing) {
            await this.prisma.product.create({
              data: {
                shopId: shop.id,
                platformProductId: p.micProductId,
                name: p.productName,
                url: p.productUrl,
                category: p.category || null,
              },
            });
          } else {
            await this.prisma.product.update({
              where: { id: existing.id },
              data: { name: p.productName, category: p.category || existing.category, platformProductId: p.micProductId },
            });
          }
        }
      }

      for (const i of payload.inquiries) {
        const preview = i.messagePreview.slice(0, 180);
        await this.prisma.micInquiryRecord.upsert({
          where: { shopId_micInquiryId: { shopId: shop.id, micInquiryId: i.micInquiryId } },
          update: {
            subject: i.subject,
            buyerName: i.buyerName,
            buyerCompany: i.buyerCompany,
            buyerCountry: i.buyerCountry,
            productId: i.productId,
            productName: i.productName,
            receivedAt: i.receivedAt ? new Date(i.receivedAt) : null,
            status: i.status,
            messagePreview: preview,
            encryptedPayload: Buffer.from(preview, 'utf8').toString('base64'),
            lastReplyAt: i.lastReplyAt ? new Date(i.lastReplyAt) : null,
            idConfidence: i.idConfidence,
            syncedAt: new Date(i.syncedAt),
          },
          create: {
            shopId: shop.id,
            micInquiryId: i.micInquiryId,
            subject: i.subject,
            buyerName: i.buyerName,
            buyerCompany: i.buyerCompany,
            buyerCountry: i.buyerCountry,
            productId: i.productId,
            productName: i.productName,
            receivedAt: i.receivedAt ? new Date(i.receivedAt) : null,
            status: i.status,
            messagePreview: preview,
            encryptedPayload: Buffer.from(preview, 'utf8').toString('base64'),
            idConfidence: i.idConfidence,
            syncedAt: new Date(i.syncedAt),
          },
        });
      }

      for (const s of payload.sourcingRequests) {
        await this.prisma.micSourcingRequest.upsert({
          where: { shopId_micRequestId: { shopId: shop.id, micRequestId: s.micRequestId } },
          update: {
            title: s.title,
            category: s.category,
            country: s.country,
            quantity: s.quantity,
            unit: s.unit,
            status: s.status,
            syncedAt: new Date(s.syncedAt),
          },
          create: {
            shopId: shop.id,
            micRequestId: s.micRequestId,
            title: s.title,
            category: s.category,
            country: s.country,
            quantity: s.quantity,
            unit: s.unit,
            status: s.status,
            syncedAt: new Date(s.syncedAt),
          },
        });
      }

      await this.prisma.micOpportunitySnapshot.create({
        data: { shopId: shop.id, payload: payload.opportunities as object, syncedAt: new Date() },
      });

      const hashes: Record<string, string> = {};
      for (const p of payload.products) hashes[p.micProductId] = p.rawSourceHash;
      await this.prisma.micSyncCursor.upsert({
        where: { shopId: shop.id },
        update: {
          lastSuccessfulSyncAt: new Date(),
          productHashes: hashes,
        },
        create: { shopId: shop.id, productHashes: hashes, lastSuccessfulSyncAt: new Date() },
      });

      const status = finalizeJobStatus(payload);
      const updated = await this.prisma.micSyncJob.update({
        where: { id: job.id },
        data: {
          status,
          productsSynced: payload.products.length,
          inquiriesSynced: payload.inquiries.length,
          sourcingSynced: payload.sourcingRequests.length,
          finishedAt: new Date(),
        },
      });
      this.logger.log(`module completed job=${job.id} status=${status}`);
      return updated;
    } catch (error) {
      await this.prisma.micSyncJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', finishedAt: new Date(), errors: { message: error instanceof Error ? error.message : 'UNKNOWN' } },
      });
      throw error;
    }
  }

  async getJob(id: string) {
    const job = await this.prisma.micSyncJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Sync job not found');
    return job;
  }

  async overview() {
    const [products, inquiries, sourcing, unreplied, conn, job] = await Promise.all([
      this.prisma.micProductRecord.count(),
      this.prisma.micInquiryRecord.count(),
      this.prisma.micSourcingRequest.count(),
      this.prisma.micInquiryRecord.count({ where: { status: { contains: 'unreplied' } } }),
      this.prisma.micAccountConnection.findFirst({ orderBy: { updatedAt: 'desc' } }),
      this.prisma.micSyncJob.findFirst({ orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      connected: Boolean(conn),
      lastSyncAt: conn?.lastSyncAt?.toISOString() ?? null,
      products,
      inquiries,
      unreplied,
      sourcing,
      lastJob: job,
    };
  }

  async listProducts(q: { status?: string; featured?: boolean; page: number; pageSize: number }) {
    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.featured ? { isFeaturedProduct: true } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.micProductRecord.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: { syncedAt: 'desc' },
      }),
      this.prisma.micProductRecord.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  listInquiries() {
    return this.prisma.micInquiryRecord.findMany({ orderBy: { syncedAt: 'desc' }, take: 200 });
  }

  async getInquiry(id: string) {
    const row = await this.prisma.micInquiryRecord.findUnique({ where: { id }, include: { analyses: true, drafts: true } });
    if (!row) throw new NotFoundException('Inquiry not found');
    return row;
  }

  async opportunities() {
    const latest = await this.prisma.micOpportunitySnapshot.findFirst({ orderBy: { createdAt: 'desc' } });
    return latest?.payload ?? { newInquiries: 0, unrepliedInquiries: 0, highIntentInquiries: 0 };
  }

  listSourcing() {
    return this.prisma.micSourcingRequest.findMany({ orderBy: { syncedAt: 'desc' }, take: 100 });
  }

  async analyzeInquiry(id: string) {
    const row = await this.getInquiry(id);
    const analysis = analyzeInquiry({
      micInquiryId: row.micInquiryId,
      subject: row.subject,
      buyerName: row.buyerName,
      buyerCompany: row.buyerCompany,
      buyerCountry: row.buyerCountry,
      productId: row.productId,
      productName: row.productName,
      receivedAt: row.receivedAt?.toISOString() ?? null,
      status: row.status,
      assignedAccount: 'UNKNOWN',
      messagePreview: row.messagePreview,
      lastReplyAt: row.lastReplyAt?.toISOString() ?? null,
      syncedAt: row.syncedAt.toISOString(),
      idConfidence: row.idConfidence,
      source: 'MIC_VIRTUAL_OFFICE',
      evidenceLevel: 'VERIFIED',
    });
    await this.prisma.inquiryAnalysis.create({ data: { inquiryId: row.id, payload: analysis as object } });
    return analysis;
  }

  async draftReply(id: string) {
    const analysis = await this.analyzeInquiry(id);
    const row = await this.prisma.micInquiryRecord.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Inquiry not found');
    const draft = draftInquiryReply(
      {
        micInquiryId: row.micInquiryId,
        subject: row.subject,
        buyerName: row.buyerName,
        buyerCompany: row.buyerCompany,
        buyerCountry: row.buyerCountry,
        productId: row.productId,
        productName: row.productName,
        receivedAt: row.receivedAt?.toISOString() ?? null,
        status: row.status,
        assignedAccount: 'UNKNOWN',
        messagePreview: row.messagePreview,
        lastReplyAt: null,
        syncedAt: row.syncedAt.toISOString(),
        idConfidence: row.idConfidence,
        source: 'MIC_VIRTUAL_OFFICE',
        evidenceLevel: 'VERIFIED',
      },
      analysis,
    );
    await this.prisma.inquiryReplyDraft.create({ data: { inquiryId: row.id, payload: draft as object } });
    return { ...draft, autoSend: false as const };
  }

  async matchRfq(id: string) {
    const rfq = await this.prisma.micSourcingRequest.findUnique({ where: { id } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    const products = await this.prisma.micProductRecord.findMany({ where: { shopId: rfq.shopId } });
    const matches = matchRfqToProducts(
      {
        micRequestId: rfq.micRequestId,
        title: rfq.title,
        category: rfq.category,
        country: rfq.country,
        quantity: rfq.quantity,
        unit: rfq.unit,
        publishedAt: rfq.publishedAt?.toISOString() ?? null,
        deadline: rfq.deadline?.toISOString() ?? null,
        status: rfq.status,
        matchingProducts: [],
        syncedAt: rfq.syncedAt.toISOString(),
        idConfidence: 0.9,
        source: 'MIC_VIRTUAL_OFFICE',
        evidenceLevel: 'VERIFIED',
      },
      products.map((p) => ({
        micProductId: p.micProductId,
        productName: p.productName,
        productUrl: p.productUrl,
        model: p.model,
        category: p.category,
        status: p.status as 'ONLINE',
        keywords: Array.isArray(p.keywords) ? (p.keywords as string[]) : [],
        attributes: {},
        tradeInfo: '',
        isFeaturedProduct: p.isFeaturedProduct,
        featuredScore: p.featuredScore,
        mainProductScore: p.featuredScore,
        updatedAtRemote: p.updatedAtRemote?.toISOString() ?? null,
        syncedAt: p.syncedAt.toISOString(),
        rawSourceHash: p.rawSourceHash,
        idConfidence: p.idConfidence,
        source: 'MIC_VIRTUAL_OFFICE' as const,
        evidenceLevel: 'VERIFIED' as const,
      })),
    );
    await this.prisma.rfqMatch.create({ data: { sourcingId: rfq.id, payload: matches as object } });
    return matches;
  }

  async draftQuote(id: string) {
    const matches = await this.matchRfq(id);
    const rfq = await this.prisma.micSourcingRequest.findUnique({ where: { id } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    return draftQuote(
      {
        micRequestId: rfq.micRequestId,
        title: rfq.title,
        category: rfq.category,
        country: rfq.country,
        quantity: rfq.quantity,
        unit: rfq.unit,
        publishedAt: null,
        deadline: null,
        status: rfq.status,
        matchingProducts: [],
        syncedAt: rfq.syncedAt.toISOString(),
        idConfidence: 0.9,
        source: 'MIC_VIRTUAL_OFFICE',
        evidenceLevel: 'VERIFIED',
      },
      matches,
    );
  }

  async purge(target: 'inquiries' | 'products' | 'all') {
    if (target === 'inquiries' || target === 'all') await this.prisma.micInquiryRecord.deleteMany();
    if (target === 'products' || target === 'all') await this.prisma.micProductRecord.deleteMany();
    if (target === 'all') {
      await this.prisma.micSourcingRequest.deleteMany();
      await this.prisma.micOpportunitySnapshot.deleteMany();
    }
    this.logger.log(`purged MIC sync data target=${target}`);
    return { ok: true, target, micOfficialDataAffected: false };
  }

  private async ensureShop(payload: MICVirtualOfficeData) {
    const user = await this.prisma.user.upsert({
      where: { email: SYSTEM_EMAIL },
      update: {},
      create: { email: SYSTEM_EMAIL, name: 'System' },
    });
    const existing = await this.prisma.shop.findFirst({ where: { userId: user.id, platform: 'MADE_IN_CHINA' } });
    if (existing) {
      return this.prisma.shop.update({
        where: { id: existing.id },
        data: { companyName: payload.account.accountLabel || existing.companyName },
      });
    }
    return this.prisma.shop.create({
      data: {
        userId: user.id,
        platform: 'MADE_IN_CHINA',
        companyName: payload.account.accountLabel || 'MIC Shop',
        shopUrl: 'https://membercenter.made-in-china.com/member/main/',
      },
    });
  }
}

void businessPriorityScore;
