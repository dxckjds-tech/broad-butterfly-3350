import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Controller('users')
export class UsersController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
