import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConsentsModule } from '../consents/consents.module';
import { DevicesModule } from '../devices/devices.module';
import { ClinicalTasksModule } from '../clinical-tasks/clinical-tasks.module';
import { WoundPhotosController } from './wound-photos.controller';
import { WoundPhotosService } from './wound-photos.service';
import { OrphanGcService } from './orphan-gc.service';

@Module({
  imports: [
    AuditModule,
    ConsentsModule,
    DevicesModule,
    ClinicalTasksModule,
  ],
  controllers: [WoundPhotosController],
  providers: [WoundPhotosService, OrphanGcService],
  exports: [WoundPhotosService, OrphanGcService],
})
export class WoundPhotosModule {}
