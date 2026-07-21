import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  CreateReferralSchema,
  DeclineReferralSchema,
  InboundReferralEmailSchema,
  IngestReferralDocumentSchema,
  Permission,
  UpdateReferralSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { ReferralsService } from './referrals.service';

@ApiTags('referrals')
@Controller('v1/referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REFERRAL_WRITE)
  list(@CurrentUser() user: AuthUser) {
    return this.referrals.list(user.orgId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REFERRAL_WRITE)
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.referrals.getById(user.orgId, id);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Referral not found' },
      });
    }
    return row;
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REFERRAL_CREATE)
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateReferralSchema)) body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.referrals.create(user, body as never, {
      idempotencyKey,
      ...requestMeta(req),
    });
  }

  /**
   * Upload/paste referral document or email body → extract fields → optional draft referral.
   * Never auto-accepts; coordinator still Accepts to start intake.
   */
  @Post('ingest')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REFERRAL_CREATE)
  ingest(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(IngestReferralDocumentSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.referrals.ingestDocument(user, body as never, requestMeta(req));
  }

  /**
   * Email integration webhook (forwarding address / inbound parse provider).
   * Detects referral-like messages, extracts, creates draft for human review.
   */
  @Post('email-inbound')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REFERRAL_CREATE)
  emailInbound(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(InboundReferralEmailSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.referrals.ingestEmail(user, body as never, requestMeta(req));
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REFERRAL_WRITE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateReferralSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.referrals.update(user, id, body as never, requestMeta(req));
  }

  @Post(':id/accept')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REFERRAL_WRITE)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.referrals.accept(user, id, requestMeta(req));
  }

  @Post(':id/decline')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.REFERRAL_WRITE)
  decline(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DeclineReferralSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.referrals.decline(user, id, body as never, requestMeta(req));
  }
}
