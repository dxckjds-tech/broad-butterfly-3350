import { Module } from '@nestjs/common';
import { MicController } from './mic.controller';
import { MicService } from './mic.service';

@Module({
  controllers: [MicController],
  providers: [MicService],
  exports: [MicService],
})
export class MicModule {}
