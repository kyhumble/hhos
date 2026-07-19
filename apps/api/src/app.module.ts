import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { ReferralsModule } from './referrals/referrals.module';
import { EpisodesModule } from './episodes/episodes.module';
import { ConsentsModule } from './consents/consents.module';
import { DocumentsModule } from './documents/documents.module';
import { AuditModule } from './audit/audit.module';
import { WoundsModule } from './wounds/wounds.module';
import { VisitsModule } from './visits/visits.module';
import { DevicesModule } from './devices/devices.module';
import { WoundPhotosModule } from './wound-photos/wound-photos.module';
import { ClinicalTasksModule } from './clinical-tasks/clinical-tasks.module';
import { OasisModule } from './oasis/oasis.module';
import { OpsModule } from './ops/ops.module';
import { OrgsModule } from './orgs/orgs.module';
import { OrdersModule } from './orders/orders.module';
import { DbModule } from './common/db.module';
import { CommonDomainModule } from './common/common.module';
import { StorageModule } from './storage/storage.module';
import { PhotoCryptoModule } from './photo-crypto/photo-crypto.module';

@Module({
  imports: [
    DbModule,
    CommonDomainModule,
    StorageModule,
    PhotoCryptoModule,
    HealthModule,
    AuthModule,
    AuditModule,
    PatientsModule,
    ReferralsModule,
    EpisodesModule,
    ConsentsModule,
    DocumentsModule,
    WoundsModule,
    VisitsModule,
    DevicesModule,
    WoundPhotosModule,
    ClinicalTasksModule,
    OasisModule,
    OpsModule,
    OrgsModule,
    OrdersModule,
  ],
})
export class AppModule {}
