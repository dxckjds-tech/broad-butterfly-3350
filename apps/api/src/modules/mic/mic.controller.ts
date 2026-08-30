import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common';
import type { MICVirtualOfficeData } from '@trade-ai/shared-types';
import { MicService } from './mic.service';

@Controller()
export class MicController {
  constructor(@Inject(MicService) private readonly mic: MicService) {}

  @Get('integrations/mic/status')
  status() {
    return this.mic.connectionStatus();
  }

  @Post('integrations/mic/sync/preview')
  preview(@Body() body: MICVirtualOfficeData & { shopId?: string; actor?: string }) {
    return this.mic.preview(body);
  }

  @Post('integrations/mic/sync')
  sync(@Body() body: MICVirtualOfficeData & { shopId?: string; confirmed?: boolean; actor?: string }) {
    return this.mic.sync(body);
  }

  @Get('integrations/mic/sync/:jobId')
  job(@Param('jobId') jobId: string) {
    return this.mic.getJob(jobId);
  }

  @Delete('integrations/mic/data')
  purge(@Query('target') target: 'inquiries' | 'products' | 'all' = 'all') {
    return this.mic.purge(target);
  }

  @Get('mic/overview')
  overview() {
    return this.mic.overview();
  }

  @Get('mic/products')
  products(
    @Query('status') status?: string,
    @Query('featured') featured?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.mic.listProducts({
      status,
      featured: featured === 'true',
      page: Number(page || 1),
      pageSize: Number(pageSize || 50),
    });
  }

  @Get('mic/inquiries')
  inquiries() {
    return this.mic.listInquiries();
  }

  @Get('mic/inquiries/:id')
  inquiry(@Param('id') id: string) {
    return this.mic.getInquiry(id);
  }

  @Get('mic/opportunities')
  opportunities() {
    return this.mic.opportunities();
  }

  @Get('mic/sourcing')
  sourcing() {
    return this.mic.listSourcing();
  }

  @Post('ai/inquiries/:id/analyze')
  analyze(@Param('id') id: string) {
    return this.mic.analyzeInquiry(id);
  }

  @Post('ai/inquiries/:id/draft-reply')
  draftReply(@Param('id') id: string) {
    return this.mic.draftReply(id);
  }

  @Post('ai/sourcing/:id/match')
  match(@Param('id') id: string) {
    return this.mic.matchRfq(id);
  }

  @Post('ai/sourcing/:id/draft-quote')
  quote(@Param('id') id: string) {
    return this.mic.draftQuote(id);
  }
}
