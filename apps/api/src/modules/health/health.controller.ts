import { Controller, Get } from '@nestjs/common';
import type { HealthPayload } from '@trade-ai/shared-types';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthPayload {
    return {
      status: 'ok',
      service: 'trade-ai-store-doctor-api',
    };
  }
}
