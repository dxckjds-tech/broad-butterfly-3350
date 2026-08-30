import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { OptimizeTitleDto } from './dto/optimize-title.dto';

@Controller('ai')
export class AiController {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  @Get('health')
  health() {
    return this.ai.health();
  }

  @Post('mic/optimize-title')
  optimizeTitle(@Body() dto: OptimizeTitleDto) {
    return this.ai.optimizeMicTitle(dto);
  }

  @Post('mic/optimize-keywords')
  optimizeKeywords(@Body() dto: OptimizeTitleDto) {
    return this.ai.optimizeMicKeywords(dto);
  }

  @Post('mic/category-check')
  categoryCheck(@Body() dto: OptimizeTitleDto) {
    return this.ai.checkMicCategory(dto);
  }
}
