import { Injectable, Logger } from '@nestjs/common';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../../common/prisma.service';

const RETAIN_DAYS = 7;

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  dir(): string {
    return process.env.BACKUP_DIR || join(process.cwd(), 'backups');
  }

  async backupIfNeeded(kind: 'first-prod-sync' | 'daily'): Promise<{ ran: boolean; path?: string }> {
    const now = new Date();
    if (kind === 'first-prod-sync') {
      const existing = await this.prisma.backupRecord.findFirst({ where: { kind } });
      if (existing) return { ran: false };
    }
    if (kind === 'daily') {
      const latest = await this.prisma.backupRecord.findFirst({ where: { kind: 'daily' }, orderBy: { createdAt: 'desc' } });
      if (latest && now.getTime() - latest.createdAt.getTime() < 20 * 60 * 60 * 1000) return { ran: false };
    }
    const path = await this.dump(kind);
    return { ran: true, path };
  }

  async dump(kind: string): Promise<string> {
    const dir = this.dir();
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = join(dir, `${kind}-${stamp}.json`);
    const payload = {
      shops: await this.prisma.shop.findMany(),
      products: await this.prisma.micProductRecord.findMany(),
      inquiries: await this.prisma.micInquiryRecord.findMany(),
      sourcing: await this.prisma.micSourcingRequest.findMany(),
    };
    writeFileSync(filePath, JSON.stringify(payload), 'utf8');
    const retainUntil = new Date(Date.now() + RETAIN_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.backupRecord.create({ data: { kind, filePath, retainUntil } });
    this.prune(dir);
    this.logger.log(`backup wrote ${filePath}`);
    return filePath;
  }

  private prune(dir: string): void {
    const cutoff = Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000;
    try {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const match = name.match(/(\d{4}-\d{2}-\d{2})/);
        if (!match) continue;
        const t = Date.parse(match[1] ?? '');
        if (Number.isFinite(t) && t < cutoff) rmSync(full, { force: true });
      }
    } catch {
      // ignore
    }
    void this.prisma.backupRecord.deleteMany({ where: { retainUntil: { lt: new Date() } } });
  }
}
