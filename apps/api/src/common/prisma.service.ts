import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('PostgreSQL connected');
    } catch (error) {
      if (process.env.ALLOW_START_WITHOUT_DATABASE !== 'true') throw error;
      this.logger.warn(
        `PostgreSQL unavailable — API started in AI-only mode. ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
