import { Module } from '@nestjs/common';
import { HospiceController } from './hospice.controller';
import { HospiceService } from './hospice.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [HospiceController],
  providers: [HospiceService],
  exports: [HospiceService],
})
export class HospiceModule {}
