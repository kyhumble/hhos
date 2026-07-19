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
  CompleteClinicalTaskSchema,
  ListClinicalTasksQuerySchema,
  Permission,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { ClinicalTasksService } from './clinical-tasks.service';

@ApiTags('clinical-tasks')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1/clinical-tasks')
export class ClinicalTasksController {
  constructor(private readonly tasks: ClinicalTasksService) {}

  /**
   * List clinical tasks (clinical lead / compliance / admin).
   */
  @Get()
  @RequirePermissions(Permission.CLINICAL_TASK_READ)
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListClinicalTasksQuerySchema)) query: unknown,
  ) {
    return this.tasks.list(user, query as never);
  }

  /**
   * Complete (HITL close) a clinical task. Never auto-cancelled by measurements.
   */
  @Post(':id/complete')
  @RequirePermissions(Permission.CLINICAL_TASK_WRITE)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CompleteClinicalTaskSchema)) body: unknown,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    return this.tasks.complete(
      user,
      id,
      body as never,
      requestMeta(req),
    );
  }
}
