import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { OptimizeTitleDto } from './dto/optimize-title.dto';
import { ConfirmProductIdentityDto, KeywordGateDto } from './dto/product-identity.dto';

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

  @Post('mic/optimize-description')
  optimizeDescription(@Body() dto: OptimizeTitleDto) {
    return this.ai.optimizeMicDescription(dto);
  }

  @Post('mic/geo-analysis')
  geoAnalysis(@Body() dto: OptimizeTitleDto) {
    return this.ai.analyzeMicGeo(dto);
  }

  @Post('mic/product-identity')
  inspectProductIdentity(@Body() dto: OptimizeTitleDto) {
    return this.ai.inspectProductIdentity(dto);
  }

  @Post('mic/universal-reason')
  universalReason(@Body() dto: OptimizeTitleDto) {
    return this.ai.universalReason(dto);
  }

  @Post('mic/product-identity/confirm')
  confirmProductIdentity(@Body() dto: ConfirmProductIdentityDto) {
    return this.ai.confirmProductIdentity(dto);
  }

  @Post('mic/keyword-gate')
  keywordGate(@Body() dto: KeywordGateDto) {
    return this.ai.gateKeywords(dto);
  }
}
