import { Module } from '@nestjs/common';
import { ProductionModule } from '../production/production.module';
import { MicController } from './mic.controller';
import { MicService } from './mic.service';

@Module({
  imports: [ProductionModule],
  controllers: [MicController],
  providers: [MicService],
  exports: [MicService],
})
export class MicModule {}
