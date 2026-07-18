import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1/documents')
export class DocumentsController {
  @Get()
  @RequirePermissions(Permission.DOCUMENT_READ)
  stub() {
    return {
      data: [],
      message: 'Document upload/presign reserved for later phase',
    };
  }
}
