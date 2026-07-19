import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateBillingClaimSchema,
  MarkClaimSubmittedSchema,
  Permission,
  type BillingClaimType,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { BillingService } from './billing.service';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('billing/readiness/:episodeId')
  @RequirePermissions(Permission.BILLING_READ)
  readiness(
    @CurrentUser() user: AuthUser,
    @Param('episodeId') episodeId: string,
    @Query('claimType') claimType?: string,
  ) {
    return this.billing.readiness(
      user,
      episodeId,
      claimType as BillingClaimType | undefined,
    );
  }

  @Get('worklists/billing')
  @RequirePermissions(Permission.BILLING_READ)
  worklist(@CurrentUser() user: AuthUser) {
    return this.billing.worklist(user);
  }

  @Post('billing/claims')
  @RequirePermissions(Permission.BILLING_WRITE)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateBillingClaimSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.billing.createClaim(user, body as never, requestMeta(req));
  }

  @Get('billing/claims')
  @RequirePermissions(Permission.BILLING_READ)
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.billing.listClaims(user, status);
  }

  @Get('billing/claims/:id')
  @RequirePermissions(Permission.BILLING_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.getClaim(user, id);
  }

  @Post('billing/claims/:id/refresh')
  @RequirePermissions(Permission.BILLING_WRITE)
  refresh(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.billing.refresh(user, id, requestMeta(req));
  }

  @Post('billing/claims/:id/export')
  @RequirePermissions(Permission.BILLING_EXPORT)
  export(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.billing.exportClaim(user, id, requestMeta(req));
  }

  @Post('billing/claims/:id/mark-submitted')
  @RequirePermissions(Permission.BILLING_EXPORT)
  markSubmitted(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MarkClaimSubmittedSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.billing.markSubmitted(user, id, body as never, requestMeta(req));
  }

  @Post('billing/claims/:id/void')
  @RequirePermissions(Permission.BILLING_WRITE)
  voidClaim(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.billing.voidClaim(user, id, requestMeta(req));
  }
}
