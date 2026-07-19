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
  AcceptInviteSchema,
  CreateOrganizationSchema,
  InviteUserSchema,
  Permission,
  UpdateOrgSettingsSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { OrgsService } from './orgs.service';

@ApiTags('orgs')
@Controller('v1')
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  /** Self-serve tenant bootstrap: creates org + admin + default roles. */
  @Post('orgs')
  create(
    @Body(new ZodValidationPipe(CreateOrganizationSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orgs.createOrganization(body as never, requestMeta(req));
  }

  /** Any authenticated member can read their tenant profile + settings. */
  @Get('orgs/me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.orgs.getMyOrg(user);
  }

  @Patch('orgs/me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ORG_SETTINGS)
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateOrgSettingsSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orgs.updateMyOrg(user, body as never, requestMeta(req));
  }

  @Get('orgs/me/members')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_ADMIN)
  members(@CurrentUser() user: AuthUser) {
    return this.orgs.listMembers(user);
  }

  @Get('orgs/me/invites')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_ADMIN)
  listInvites(@CurrentUser() user: AuthUser) {
    return this.orgs.listInvites(user);
  }

  @Post('orgs/me/invites')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_ADMIN)
  invite(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(InviteUserSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orgs.invite(user, body as never, requestMeta(req));
  }

  @Post('orgs/me/invites/:id/resend')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_ADMIN)
  resendInvite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orgs.resendInvite(user, id, requestMeta(req));
  }

  @Get('invites/peek')
  peek(@Query('token') token?: string) {
    if (!token) {
      return { error: { code: 'VALIDATION_FAILED', message: 'token query required' } };
    }
    return this.orgs.peekInvite(token);
  }

  @Post('invites/accept')
  accept(
    @Body(new ZodValidationPipe(AcceptInviteSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.orgs.acceptInvite(body as never, requestMeta(req));
  }

  // Keep param route last among invites if expanded
  @Get('invites/:token')
  peekPath(@Param('token') token: string) {
    return this.orgs.peekInvite(token);
  }
}
