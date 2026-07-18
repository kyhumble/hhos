import { Global, Module } from '@nestjs/common';
import { ChecklistService } from './checklist.service';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  providers: [ChecklistService, PermissionsGuard],
  exports: [ChecklistService, PermissionsGuard],
})
export class CommonDomainModule {}
