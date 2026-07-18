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
  CreateVisitSchema,
  Permission,
  UpdateVisitSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { VisitsService } from './visits.service';

@ApiTags('visits')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get('episodes/:episodeId/visits')
  @RequirePermissions(Permission.WOUND_PHOTO_READ)
  list(
    @CurrentUser() user: AuthUser,
    @Param('episodeId') episodeId: string,
  ) {
    return this.visits.listForEpisode(user, episodeId);
  }

  @Post('episodes/:episodeId/visits')
  @RequirePermissions(Permission.WOUND_PHOTO_CAPTURE)
  create(
    @CurrentUser() user: AuthUser,
    @Param('episodeId') episodeId: string,
    @Body(new ZodValidationPipe(CreateVisitSchema)) body: unknown,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.visits.create(user, episodeId, body as never, requestMeta(req));
  }

  @Patch('visits/:id')
  @RequirePermissions(Permission.WOUND_PHOTO_CAPTURE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateVisitSchema)) body: unknown,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.visits.update(user, id, body as never, requestMeta(req));
  }
}
