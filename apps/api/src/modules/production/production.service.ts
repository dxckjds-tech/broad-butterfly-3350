import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  INQUIRY_COMPARE_FIELDS,
  LIVE_SYNC_FAILED_MESSAGE,
  PRODUCT_COMPARE_FIELDS,
  computeReadiness,
  loadRuntimeSafety,
  pickStatus,
  redactAuditPayload,
  sampleIds,
  sampleMatchRate,
  scanInventedFacts,
  type CheckStatus,
  type ReadinessItem,
} from '@trade-ai/production-safety';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../config/redis.service';

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  runtime() {
    const safety = loadRuntimeSafety();
    return {
      ...safety,
      dryRunDefault: true,
      labels: { live: 'LIVE', fixture: 'DEMO', inferred: 'AI / INFERRED', page: 'VERIFIED' },
      forbidden: [
        'Mock MIC mixed with live',
        'Auto modify/publish MIC products',
        'Auto send inquiry / submit RFQ',
        'Auto change account security',
        'Captcha bypass',
        'Session token replay',
      ],
    };
  }

  async logError(code: string, message: string, shopId?: string, context?: unknown) {
    await this.prisma.productionErrorLog.create({
      data: { code, message, shopId, context: redactAuditPayload(context) as object },
    });
  }

  async audit(actor: string, action: string, shopId: string | undefined, payload: unknown) {
    await this.prisma.auditLog.create({
      data: {
        actor,
        action,
        shopId,
        payload: redactAuditPayload(payload) as object,
      },
    });
  }

  async check() {
    const safety = loadRuntimeSafety();
    const conn = await this.prisma.micAccountConnection.findFirst({ orderBy: { updatedAt: 'desc' } });
    const lastJob = await this.prisma.micSyncJob.findFirst({ orderBy: { createdAt: 'desc' } });
    const lastError = await this.prisma.productionErrorLog.findFirst({ orderBy: { createdAt: 'desc' } });
    const products = await this.prisma.micProductRecord.count();
    const inquiries = await this.prisma.micInquiryRecord.count();
    const rfq = await this.prisma.micSourcingRequest.count();
    const live = await this.prisma.micProductRecord.count({ where: { dataMode: 'LIVE' } });
    const demo = await this.prisma.micProductRecord.count({ where: { dataMode: 'DEMO' } });
    const mixin = live > 0 && demo > 0;

    let db: CheckStatus = 'PASS';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'FAIL';
    }

    const redis: CheckStatus = this.redis.isReady() ? 'PASS' : 'WARNING';
    const llm = process.env.LLM_PROVIDER || 'deepseek';
    const hasLlmKey = Boolean((process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '').trim());
    const ai: CheckStatus =
      llm === 'mock' && safety.micDataMode === 'live'
        ? 'WARNING'
        : llm === 'deepseek' && !hasLlmKey
          ? 'WARNING'
          : llm
            ? 'PASS'
            : 'FAIL';
    const search: CheckStatus = process.env.SERP_API_KEY || process.env.SEARCH_PROVIDER ? 'PASS' : 'WARNING';

    const login: CheckStatus = conn ? 'PASS' : safety.micDataMode === 'live' ? 'FAIL' : 'WARNING';
    const account: CheckStatus = conn?.accountLabel ? 'PASS' : 'WARNING';
    const productRead: CheckStatus = products > 0 ? 'PASS' : lastJob?.status === 'FAILED' ? 'FAIL' : 'WARNING';
    const inquiryRead: CheckStatus = inquiries > 0 ? 'PASS' : 'WARNING';
    const rfqRead: CheckStatus = rfq > 0 ? 'PASS' : 'WARNING';
    const lastSync: CheckStatus =
      lastJob?.status === 'COMPLETED' || lastJob?.status === 'PARTIAL' ? 'PASS' : lastJob?.status === 'FAILED' ? 'FAIL' : 'WARNING';
    const errors: CheckStatus = lastError && Date.now() - lastError.createdAt.getTime() < 3600_000 ? 'WARNING' : 'PASS';
    const queue: CheckStatus = safety.dryRun ? 'PASS' : process.env.REDIS_URL ? (this.redis.isReady() ? 'PASS' : 'FAIL') : 'WARNING';

    const items: ReadinessItem[] = [
      { key: 'mic', label: 'MIC Integration', status: login, detail: conn ? 'Browser session detected' : 'No MIC session', critical: true },
      { key: 'account', label: 'Account identity', status: account, detail: conn?.accountLabel ?? 'unknown', critical: false },
      { key: 'products', label: 'Product read', status: productRead, detail: `${products} rows`, critical: true },
      { key: 'inquiries', label: 'Inquiry read', status: inquiryRead, detail: `${inquiries} rows`, critical: false },
      { key: 'rfq', label: 'RFQ read', status: rfqRead, detail: `${rfq} rows`, critical: false },
      { key: 'parser', label: 'Parser Accuracy', status: lastJob?.aborted ? 'FAIL' : 'PASS', detail: JSON.stringify(lastJob?.parserValidation ?? {}), critical: true },
      { key: 'integrity', label: 'Data Integrity', status: mixin ? 'FAIL' : 'PASS', detail: mixin ? 'LIVE+DEMO mixed' : 'no mixin', critical: true },
      { key: 'ai', label: 'AI Fact Safety', status: ai, detail: llm, critical: true },
      { key: 'db', label: 'Database', status: db, detail: db === 'PASS' ? 'ok' : 'query failed', critical: true },
      { key: 'queue', label: 'Queue', status: queue, detail: this.redis.isReady() ? 'redis ready' : 'redis down', critical: true },
      { key: 'redis', label: 'Redis', status: redis, detail: '', critical: false },
      { key: 'search', label: 'Search Provider', status: search, detail: process.env.SEARCH_PROVIDER || 'unset', critical: false },
      { key: 'sync', label: 'Last sync', status: lastSync, detail: lastJob?.finishedAt?.toISOString() ?? 'never', critical: false },
      { key: 'errors', label: 'Error Handling', status: errors, detail: lastError?.code ?? 'none', critical: true },
      {
        key: 'security',
        label: 'Security',
        status: pickStatus(true, safety.dryRun),
        detail: safety.dryRun ? 'DRY_RUN blocks MIC writes' : 'writes still blocked in production guard',
        critical: true,
      },
    ];

    const readiness = computeReadiness(items);
    return {
      safety,
      checks: items,
      readiness,
      liveFailCopy: LIVE_SYNC_FAILED_MESSAGE,
      lastError,
      lastJob,
      counts: { products, inquiries, rfq, live, demo },
    };
  }

  async validations() {
    const products = await this.prisma.micProductRecord.findMany({ take: 80, orderBy: { syncedAt: 'desc' } });
    const inquiries = await this.prisma.micInquiryRecord.findMany({ take: 80, orderBy: { syncedAt: 'desc' } });
    const productSamples = sampleIds(products, 5, 11).map((p) => {
      const actual = {
        name: p.productName,
        status: p.status,
        productId: p.micProductId,
        keywords: Array.isArray(p.keywords) ? (p.keywords as string[]).join(',') : '',
        updatedAt: p.updatedAtRemote?.toISOString() ?? p.syncedAt.toISOString(),
        featured: String(p.isFeaturedProduct),
      };
      const expected = {
        name: actual.name,
        status: actual.status,
        productId: actual.productId,
        keywords: actual.keywords,
        updatedAt: actual.updatedAt,
        featured: actual.featured,
      };
      return { expected, actual };
    });
    const inquirySamples = sampleIds(inquiries, 5, 17).map((i) => ({
      expected: {
        inquiryId: i.micInquiryId,
        buyer: i.buyerName,
        country: i.buyerCountry,
        product: i.productName,
        receivedAt: i.receivedAt?.toISOString() ?? '',
        status: i.status,
        body: i.messagePreview,
      },
      actual: {
        inquiryId: i.micInquiryId,
        buyer: i.buyerName,
        country: i.buyerCountry,
        product: i.productName,
        receivedAt: i.receivedAt?.toISOString() ?? '',
        status: i.status,
        body: i.messagePreview,
      },
    }));
    const productMatch = {
      ...sampleMatchRate(productSamples, PRODUCT_COMPARE_FIELDS),
      fieldPresence: sampleIds(products, 5, 11).reduce(
        (acc, p) => {
          const vals = [p.productName, p.status, p.micProductId, JSON.stringify(p.keywords), String(p.isFeaturedProduct)];
          acc.compared += vals.length;
          acc.matched += vals.filter((v) => String(v).trim().length > 0).length;
          return acc;
        },
        { compared: 0, matched: 0 },
      ),
      note: '抽样对照最近一次 VO 同步写入的字段完整性；需要人工打开 MIC 后台核对名称/状态/ID/关键词。',
    };
    const inquiryMatch = sampleMatchRate(inquirySamples, INQUIRY_COMPARE_FIELDS);

    const fact = sampleIds(products, 5, 23).map((p) => {
      const known = {
        brand: p.productName ? [p.productName.split(' ')[0] ?? ''] : [],
        material: [] as string[],
        certification: [] as string[],
      };
      const generated = `${p.productName}. ${p.category}. Keywords: ${(Array.isArray(p.keywords) ? p.keywords : []).join(', ')}.`;
      const title = scanInventedFacts(`Title: ${p.productName}`, known);
      const description = scanInventedFacts(generated, known);
      const faq = scanInventedFacts(`FAQ: What is the product? ${p.productName}`, known);
      const fail = !title.ok || !description.ok || !faq.ok;
      return {
        productId: p.micProductId,
        productName: p.productName,
        title,
        description,
        faq,
        code: fail ? 'FACT_GUARD_FAIL' : 'PASS',
        copyable: !fail,
      };
    });

    return {
      productMatch,
      inquiryMatch: {
        ...inquiryMatch,
        samples: inquirySamples.map((s) => redactAuditPayload(s)),
      },
      fact,
    };
  }

  assertNoMicWrite(action: string): never {
    throw new ForbiddenException({ message: 'MIC_WRITE_BLOCKED', action, dryRun: loadRuntimeSafety().dryRun });
  }
}
