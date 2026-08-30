import { Controller, Get, Inject } from '@nestjs/common';
import { ProductionService } from './production.service';

@Controller()
export class ProductionController {
  constructor(@Inject(ProductionService) private readonly production: ProductionService) {}

  @Get('production/runtime')
  runtime() {
    return this.production.runtime();
  }

  @Get('production-check')
  check() {
    return this.production.check();
  }

  @Get('production-check/validations')
  validations() {
    return this.production.validations();
  }
}
