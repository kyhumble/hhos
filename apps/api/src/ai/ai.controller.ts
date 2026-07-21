import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@hhos/shared';
import { AiService } from './ai.service';
import { AuthGuard } from '../common/auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';
import { requestMeta } from '../common/request-context';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('v1/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /**
   * Generate HITL suggestions for a visit (mocked until real models are wired).
   * Feature-flagged. Returns empty array when disabled.
   * Does not write clinical facts — only returns advisory suggestions and audits generation.
   */
  @Post('visits/:visitId/suggestions')
  @RequirePermissions(
    Permission.OASIS_READ,
    Permission.OASIS_WRITE,
    Permission.ROUTING_SUGGEST,
    Permission.VISIT_TASK_READ,
  )
  async visitSuggestions(
    @Param('visitId') visitId: string,
    @CurrentUser() user: AuthUser,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    const meta = requestMeta(req);
    const suggestions = await this.ai.generateVisitSuggestions({
      visitId,
      user,
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { suggestions, enabled: this.ai.isEnabled() };
  }

  /**
   * Record clinician decision on a suggestion (accept / edit / reject).
   * Always audited. Does not auto-apply clinical content — callers must use normal clinical write paths.
   * Permission set matches AI Assist audience (coordinators, leads, field clinicians).
   */
  @Post('suggestions/:id/decision')
  @RequirePermissions(
    Permission.OASIS_READ,
    Permission.OASIS_WRITE,
    Permission.ROUTING_SUGGEST,
    Permission.VISIT_TASK_WRITE,
  )
  async decision(
    @Param('id') suggestionId: string,
    @Body()
    body: {
      decision: 'accepted' | 'edited' | 'rejected';
      humanEdit?: string;
      targetResourceType?: string;
      targetResourceId?: string;
    },
    @CurrentUser() user: AuthUser,
    @Req()
    req: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    },
  ) {
    const meta = requestMeta(req);
    await this.ai.recordDecision({
      suggestionId,
      user,
      decision: body.decision,
      humanEdit: body.humanEdit,
      targetResourceType: body.targetResourceType,
      targetResourceId: body.targetResourceId,
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: true };
  }
}
