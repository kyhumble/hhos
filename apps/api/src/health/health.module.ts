import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DbModule } from '../common/db.module';

@Module({
  imports: [DbModule],
  controllers: [HealthController],
})
export class HealthModule {}
