import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateWoundSchema,
  Permission,
  UpdateWoundSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { WoundsService } from './wounds.service';

@ApiTags('wounds')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1')
export class WoundsController {
  constructor(private readonly wounds: WoundsService) {}

  @Get('episodes/:episodeId/wounds')
  @RequirePermissions(Permission.WOUND_PHOTO_READ)
  list(
    @CurrentUser() user: AuthUser,
    @Param('episodeId') episodeId: string,
  ) {
    return this.wounds.listForEpisode(user, episodeId);
  }

  @Post('episodes/:episodeId/wounds')
  @RequirePermissions(Permission.WOUND_PHOTO_CAPTURE)
  create(
    @CurrentUser() user: AuthUser,
    @Param('episodeId') episodeId: string,
    @Body(new ZodValidationPipe(CreateWoundSchema)) body: unknown,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.wounds.create(user, episodeId, body as never, requestMeta(req));
  }

  @Patch('wounds/:id')
  @RequirePermissions(Permission.WOUND_PHOTO_CAPTURE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWoundSchema)) body: unknown,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.wounds.update(user, id, body as never, requestMeta(req));
  }
}
