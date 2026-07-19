import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateHospitalizationAlertSchema,
  CreateVisitTaskSchema,
  DecideRouteSuggestionSchema,
  GenerateRouteSuggestionsSchema,
  Permission,
  UpdateHospitalizationAlertSchema,
  UpdateVisitTaskSchema,
  UpsertClinicianProfileSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { OpsService } from './ops.service';

@ApiTags('ops')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1')
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  // Clinician profiles
  @Get('clinician-profiles')
  @RequirePermissions(Permission.ROUTING_READ)
  listProfiles(@CurrentUser() user: AuthUser) {
    return this.ops.listProfiles(user);
  }

  @Put('clinician-profiles')
  @RequirePermissions(Permission.ROUTING_SUGGEST, Permission.ROUTING_DECIDE)
  upsertProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpsertClinicianProfileSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.ops.upsertProfile(user, body as never, requestMeta(req));
  }

  // Routing suggestions (HITL)
  @Post('routing/suggestions')
  @RequirePermissions(Permission.ROUTING_SUGGEST)
  generate(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(GenerateRouteSuggestionsSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.ops.generateSuggestions(user, body as never, requestMeta(req));
  }

  @Get('routing/suggestions')
  @RequirePermissions(Permission.ROUTING_READ)
  listSuggestions(
    @CurrentUser() user: AuthUser,
    @Query('episodeId') episodeId?: string,
  ) {
    return this.ops.listSuggestions(user, episodeId);
  }

  @Post('routing/suggestions/:id/decide')
  @RequirePermissions(Permission.ROUTING_DECIDE)
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DecideRouteSuggestionSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.ops.decide(user, id, body as never, requestMeta(req));
  }

  // Visit tasks
  @Get('visit-tasks')
  @RequirePermissions(Permission.VISIT_TASK_READ)
  listTasks(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('assigneeUserId') assigneeUserId?: string,
  ) {
    return this.ops.listVisitTasks(user, { status, assigneeUserId });
  }

  @Post('visit-tasks')
  @RequirePermissions(Permission.VISIT_TASK_WRITE)
  createTask(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateVisitTaskSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.ops.createVisitTask(user, body as never, requestMeta(req));
  }

  @Patch('visit-tasks/:id')
  @RequirePermissions(Permission.VISIT_TASK_WRITE)
  updateTask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateVisitTaskSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.ops.updateVisitTask(user, id, body as never, requestMeta(req));
  }

  // Hospitalization alerts
  @Get('hospitalization-alerts')
  @RequirePermissions(Permission.ALERT_READ)
  listAlerts(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.ops.listAlerts(user, status);
  }

  @Post('hospitalization-alerts')
  @RequirePermissions(Permission.ALERT_WRITE)
  createAlert(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateHospitalizationAlertSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.ops.createAlert(user, body as never, requestMeta(req));
  }

  @Patch('hospitalization-alerts/:id')
  @RequirePermissions(Permission.ALERT_WRITE)
  updateAlert(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateHospitalizationAlertSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.ops.updateAlert(user, id, body as never, requestMeta(req));
  }
}
