import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.product.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { shop: true },
    });
  }
}
