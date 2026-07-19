import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClinicalTasksController } from './clinical-tasks.controller';
import { ClinicalTasksService } from './clinical-tasks.service';

@Module({
  imports: [AuditModule],
  controllers: [ClinicalTasksController],
  providers: [ClinicalTasksService],
  exports: [ClinicalTasksService],
})
export class ClinicalTasksModule {}
