import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthGuard } from '../common/auth.guard';
import { Permissions } from '../common/permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/auth.types';

@Controller('v1/ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  /**
   * Generate HITL suggestions for a visit (mocked until real models are wired).
   * Feature-flagged. Returns empty array when disabled.
   */
  @Post('visits/:visitId/suggestions')
  @Permissions('visit:read')
  async visitSuggestions(
    @Param('visitId') visitId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: { requestId?: string },
  ) {
    const suggestions = await this.ai.generateVisitSuggestions({
      visitId,
      orgId: user.orgId,
      actorId: user.userId,
      requestId: req.requestId,
    });
    return { suggestions, enabled: this.ai.isEnabled() };
  }

  /**
   * Record clinician decision on a suggestion (accept / edit / reject).
   * Always audited.
   */
  @Post('suggestions/:id/decision')
  @Permissions('visit:write')
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
    @Req() req: { requestId?: string },
  ) {
    await this.ai.recordDecision({
      suggestionId,
      orgId: user.orgId,
      actorId: user.userId,
      decision: body.decision,
      humanEdit: body.humanEdit,
      targetResourceType: body.targetResourceType,
      targetResourceId: body.targetResourceId,
      requestId: req.requestId,
    });
    return { ok: true };
  }
}
