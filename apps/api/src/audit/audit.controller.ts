import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1/audit-events')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ)
  list(
    @CurrentUser() user: AuthUser,
    @Query('patientId') patientId?: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(100, Math.max(1, Number(limit) || 50)) : 50;
    return this.audit.list(user.orgId, { patientId, limit: n });
  }
}
