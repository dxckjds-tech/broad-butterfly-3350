import { Module } from '@nestjs/common';
import { BackupService } from '../backup/backup.service';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';

@Module({
  controllers: [ProductionController],
  providers: [ProductionService, BackupService],
  exports: [ProductionService, BackupService],
})
export class ProductionModule {}
