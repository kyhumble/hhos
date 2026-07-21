import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuditModule } from '../audit/audit.module';
import { CommonDomainModule } from '../common/common.module';

@Module({
  imports: [AuditModule, CommonDomainModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
