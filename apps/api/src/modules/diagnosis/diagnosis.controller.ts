import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import type { PlatformPageData } from '@trade-ai/shared-types';
import { DiagnosisService } from './diagnosis.service';
import { PlatformPageDataDto } from './dto/page-data.dto';

@Controller('diagnosis')
export class DiagnosisController {
  private readonly logger = new Logger(DiagnosisController.name);

  constructor(private readonly diagnosis: DiagnosisService) {}

  @Post('page')
  async diagnosePage(@Body() body: PlatformPageDataDto) {
    this.logger.log(`POST /diagnosis/page ${body.pageType} ${body.url}`);
    return this.diagnosis.diagnoseAndPersist(body as PlatformPageData);
  }

  @Get('stats')
  stats() {
    return this.diagnosis.stats();
  }

  @Get('reports')
  reports() {
    return this.diagnosis.listReports();
  }
}
