import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  CaptureConsentSchema,
  Permission,
  RevokeConsentSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { ConsentsService } from './consents.service';

@ApiTags('consents')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1')
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Get('consent-templates')
  @RequirePermissions(Permission.CONSENT_READ)
  listTemplates(
    @CurrentUser() user: AuthUser,
    @Query('locale') locale?: string,
  ) {
    return this.consents.listActiveTemplates(user.orgId, locale);
  }

  @Get('consent-templates/:id')
  @RequirePermissions(Permission.CONSENT_READ)
  async getTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.consents.getTemplate(user.orgId, id);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
    }
    return row;
  }

  @Get('patients/:patientId/consents')
  @RequirePermissions(Permission.CONSENT_READ)
  listPatientConsents(
    @CurrentUser() user: AuthUser,
    @Param('patientId') patientId: string,
  ) {
    return this.consents.listPatientConsents(user, patientId);
  }

  @Post('patients/:patientId/consents')
  @RequirePermissions(Permission.CONSENT_CAPTURE)
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  capture(
    @CurrentUser() user: AuthUser,
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(CaptureConsentSchema)) body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    const meta = requestMeta(req);
    return this.consents.capture(user, patientId, body as never, {
      idempotencyKey,
      ...meta,
    });
  }

  @Post('consents/:id/revoke')
  @RequirePermissions(Permission.CONSENT_REVOKE)
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RevokeConsentSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.consents.revoke(user, id, body as never, requestMeta(req));
  }

  @Get('patients/:patientId/active-purposes')
  @RequirePermissions(Permission.CONSENT_READ)
  activePurposes(
    @CurrentUser() user: AuthUser,
    @Param('patientId') patientId: string,
  ) {
    return this.consents.activePurposes(user, patientId);
  }
}
