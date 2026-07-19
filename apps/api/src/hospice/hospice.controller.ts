import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ActivateHospiceElectionSchema,
  ChangeHospiceLocSchema,
  CreateHospiceElectionSchema,
  Permission,
  RequestHospiceCertSchema,
  RevokeHospiceElectionSchema,
  UpdateHospiceElectionSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { HospiceService } from './hospice.service';

@ApiTags('hospice')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1')
export class HospiceController {
  constructor(private readonly hospice: HospiceService) {}

  @Post('hospice/elections')
  @RequirePermissions(Permission.HOSPICE_WRITE)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateHospiceElectionSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.hospice.create(user, body as never, requestMeta(req));
  }

  @Get('hospice/elections')
  @RequirePermissions(Permission.HOSPICE_READ)
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.hospice.list(user, { status, patientId });
  }

  @Get('hospice/elections/:id')
  @RequirePermissions(Permission.HOSPICE_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hospice.getById(user, id);
  }

  @Patch('hospice/elections/:id')
  @RequirePermissions(Permission.HOSPICE_WRITE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateHospiceElectionSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.hospice.update(user, id, body as never, requestMeta(req));
  }

  @Post('hospice/elections/:id/activate')
  @RequirePermissions(Permission.HOSPICE_WRITE)
  activate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ActivateHospiceElectionSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.hospice.activate(user, id, body as never, requestMeta(req));
  }

  @Post('hospice/elections/:id/revoke')
  @RequirePermissions(Permission.HOSPICE_WRITE)
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RevokeHospiceElectionSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.hospice.revoke(user, id, body as never, requestMeta(req));
  }

  @Post('hospice/elections/:id/loc')
  @RequirePermissions(Permission.HOSPICE_WRITE)
  changeLoc(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangeHospiceLocSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.hospice.changeLoc(user, id, body as never, requestMeta(req));
  }

  @Post('hospice/elections/:id/request-cert')
  @RequirePermissions(Permission.HOSPICE_WRITE, Permission.ORDER_WRITE)
  requestCert(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RequestHospiceCertSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.hospice.requestCert(user, id, body as never, requestMeta(req));
  }

  @Get('worklists/hospice')
  @RequirePermissions(Permission.HOSPICE_READ)
  worklist(@CurrentUser() user: AuthUser) {
    return this.hospice.worklist(user);
  }
}
