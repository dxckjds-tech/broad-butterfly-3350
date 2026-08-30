import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    // ioredis emits an `error` event in addition to rejecting connect().
    // The listener prevents an optional cache outage from becoming noisy.
    client.on('error', () => undefined);
    try {
      await client.connect();
      const pong = await client.ping();
      this.client = client;
      this.logger.log(`Redis connected (${pong})`);
    } catch (error) {
      client.disconnect();
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
