import { Controller, Get } from '@nestjs/common';
import { listMicRules } from '@trade-ai/mic-rule-engine';

@Controller('rules')
export class RulesController {
  @Get()
  list(): Array<{
    id: string;
    name: string;
    category: string;
    severity: string;
    title: string;
    description: string;
    suggestion: string;
  }> {
    return listMicRules();
  }
}
