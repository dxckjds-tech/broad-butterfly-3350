import { Controller, Get } from '@nestjs/common';
import { listMicRules } from '@trade-ai/mic-rule-engine';

@Controller('rules')
export class RulesController {
  @Get()
  list() {
    return listMicRules();
  }
}
