import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OasisController } from './oasis.controller';
import { OasisService } from './oasis.service';

@Module({
  imports: [AuditModule],
  controllers: [OasisController],
  providers: [OasisService],
  exports: [OasisService],
})
export class OasisModule {}
