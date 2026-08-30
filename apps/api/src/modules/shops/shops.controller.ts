import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ShopsService } from './shops.service';

@Controller('shops')
export class ShopsController {
  constructor(@Inject(ShopsService) private readonly shops: ShopsService) {}

  @Get()
  list() {
    return this.shops.listSummaries();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.shops.getById(id);
  }
}
