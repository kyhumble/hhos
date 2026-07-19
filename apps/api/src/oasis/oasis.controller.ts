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
  CreateOasisAssessmentSchema,
  OasisListQuerySchema,
  Permission,
  ReviewOasisSchema,
  SubmitOasisSchema,
  UpsertOasisAnswersSchema,
} from '@hhos/shared';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestMeta } from '../common/request-context';
import { OasisService } from './oasis.service';

@ApiTags('oasis')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1')
export class OasisController {
  constructor(private readonly oasis: OasisService) {}

  @Get('oasis/items')
  @RequirePermissions(Permission.OASIS_READ)
  items() {
    return this.oasis.itemLibrary();
  }

  @Get('oasis/assessments')
  @RequirePermissions(Permission.OASIS_READ)
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(OasisListQuerySchema)) query: unknown,
  ) {
    return this.oasis.list(user, query as never);
  }

  @Get('worklists/oasis-review')
  @RequirePermissions(Permission.OASIS_REVIEW)
  reviewQueue(@CurrentUser() user: AuthUser) {
    return this.oasis.reviewQueue(user);
  }

  @Post('oasis/assessments')
  @RequirePermissions(Permission.OASIS_WRITE)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateOasisAssessmentSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.oasis.create(user, body as never, requestMeta(req));
  }

  @Get('oasis/assessments/:id')
  @RequirePermissions(Permission.OASIS_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.oasis.getById(user, id);
  }

  @Patch('oasis/assessments/:id/answers')
  @RequirePermissions(Permission.OASIS_WRITE)
  upsertAnswers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpsertOasisAnswersSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.oasis.upsertAnswers(user, id, body as never, requestMeta(req));
  }

  @Post('oasis/assessments/:id/validate')
  @RequirePermissions(Permission.OASIS_READ)
  validate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.oasis.validate(user, id);
  }

  @Post('oasis/assessments/:id/submit')
  @RequirePermissions(Permission.OASIS_SUBMIT)
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SubmitOasisSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    const b = body as { note?: string };
    return this.oasis.submit(user, id, b.note, requestMeta(req));
  }

  @Post('oasis/assessments/:id/review')
  @RequirePermissions(Permission.OASIS_REVIEW, Permission.OASIS_LOCK)
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReviewOasisSchema)) body: unknown,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.oasis.review(user, id, body as never, requestMeta(req));
  }
}
