import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      await this.client.connect();
      const pong = await this.client.ping();
      this.logger.log(`Redis connected (${pong})`);
    } catch (error) {
      this.logger.warn(
        `Redis unavailable — Phase 1 continues without cache. ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }

  isReady(): boolean {
    return this.client?.status === 'ready';
  }
}
