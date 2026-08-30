import { Body, Controller, Get, Inject, Param, Patch } from '@nestjs/common';
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

  @Patch(':id/pilot')
  setPilot(@Param('id') id: string, @Body() body: { pilot?: boolean }) {
    return this.shops.setPilot(id, Boolean(body.pilot));
  }
}
