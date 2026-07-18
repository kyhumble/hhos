import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConsentsModule } from '../consents/consents.module';
import { DevicesModule } from '../devices/devices.module';
import { WoundPhotosController } from './wound-photos.controller';
import { WoundPhotosService } from './wound-photos.service';

@Module({
  imports: [AuditModule, ConsentsModule, DevicesModule],
  controllers: [WoundPhotosController],
  providers: [WoundPhotosService],
  exports: [WoundPhotosService],
})
export class WoundPhotosModule {}
