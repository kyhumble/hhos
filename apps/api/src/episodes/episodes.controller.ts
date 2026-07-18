import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AssignCareTeamSchema,
  Permission,
  UpdateEpisodeSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { EpisodesService } from './episodes.service';

@ApiTags('episodes')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1')
export class EpisodesController {
  constructor(private readonly episodes: EpisodesService) {}

  @Get('episodes')
  @RequirePermissions(Permission.EPISODE_READ)
  list(@CurrentUser() user: AuthUser) {
    return this.episodes.list(user);
  }

  @Get('episodes/:id')
  @RequirePermissions(Permission.EPISODE_READ)
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.episodes.getById(user, id);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Episode not found' },
      });
    }
    return row;
  }

  @Patch('episodes/:id')
  @RequirePermissions(Permission.EPISODE_WRITE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateEpisodeSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.episodes.update(user, id, body as never, requestMeta(req));
  }

  @Post('episodes/:id/care-team')
  @RequirePermissions(Permission.EPISODE_ASSIGN)
  assignCareTeam(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignCareTeamSchema)) body: unknown,
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.episodes.assignCareTeam(user, id, body as never, requestMeta(req));
  }

  @Get('worklists/intake')
  @RequirePermissions(Permission.EPISODE_READ)
  worklist(@CurrentUser() user: AuthUser) {
    return this.episodes.intakeWorklist(user);
  }
}
