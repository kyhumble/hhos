import { Module } from '@nestjs/common';
import { WoundsController } from './wounds.controller';
import { WoundsService } from './wounds.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [WoundsController],
  providers: [WoundsService],
  exports: [WoundsService],
})
export class WoundsModule {}
