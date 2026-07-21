import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AISuggestion, AmbientDraft, RiskScore } from '@hhos/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { isServiceAiEnabled } from '../common/features';

/**
 * Lumina AI service — currently mocked for HITL foundation.
 * Real model integration will replace the mock generators later.
 * All outputs are suggestions only; clinician must accept/edit/reject.
 * See docs/compliance/ai-guardrails.md and packages/shared/src/ai.ts.
 */
@Injectable()
export class AiService {
  private readonly log = new Logger(AiService.name);

  constructor(private readonly audit: AuditService) {}

  isEnabled(org?: { features?: { serviceAi?: boolean } } | null): boolean {
    // Prefer dedicated flag; fall back to Service AI flag.
    if (process.env.FEATURE_AI_SUGGESTIONS !== undefined) {
      const v = process.env.FEATURE_AI_SUGGESTIONS.toLowerCase();
      if (v === '1' || v === 'true' || v === 'yes') return true;
      if (v === '0' || v === 'false' || v === 'no') return false;
    }
    return isServiceAiEnabled(org);
  }

  async generateVisitSuggestions(params: {
    visitId: string;
    user: AuthUser;
    requestId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<AISuggestion[]> {
    if (!this.isEnabled()) {
      return [];
    }

    const now = new Date().toISOString();
    const suggestions: AISuggestion[] = [
      {
        id: randomUUID(),
        type: 'note_section',
        targetPath: 'note.assessment',
        title: 'Assessment draft',
        content:
          'Patient reports improved mobility since last visit. Gait steady with rolling walker. No new falls. Mild residual edema bilateral lower extremities; elevation teaching reinforced.',
        provenance: {
          modelVersion: 'mock-v0.1',
          confidence: 0.78,
          factors: [
            'prior visit narrative',
            'stated functional status',
            'edema observation',
          ],
          evidence: ['previous assessment delta', 'patient self-report'],
          generatedAt: now,
          requestId: params.requestId ?? undefined,
        },
        status: 'pending',
      },
      {
        id: randomUUID(),
        type: 'oasis_item',
        targetPath: 'oasis.M1800',
        title: 'M1800 Grooming',
        content: '1 — Grooming utensils must be placed within reach',
        structured: { code: '1' },
        provenance: {
          modelVersion: 'mock-v0.1',
          confidence: 0.71,
          factors: ['stated need for setup', 'prior M1800'],
          generatedAt: now,
          requestId: params.requestId ?? undefined,
        },
        status: 'pending',
      },
      {
        id: randomUUID(),
        type: 'risk_flag',
        title: 'Elevated fall risk',
        content:
          'Recent gait change + residual edema + age band. Consider focused balance assessment and home safety review this visit.',
        provenance: {
          modelVersion: 'mock-v0.1',
          confidence: 0.82,
          factors: ['gait change', 'edema', 'age band'],
          generatedAt: now,
          requestId: params.requestId ?? undefined,
        },
        status: 'pending',
      },
    ];

    try {
      await this.audit.writeFromUser(params.user, {
        action: 'ai.suggestion.generated',
        resourceType: 'Visit',
        resourceId: params.visitId,
        after: {
          count: suggestions.length,
          types: suggestions.map((s) => s.type),
          modelVersion: 'mock-v0.1',
        },
        requestId: params.requestId,
        ip: params.ip,
        userAgent: params.userAgent,
      });
    } catch (err) {
      this.log.warn(`AI generation audit failed: ${(err as Error).message}`);
    }

    return suggestions;
  }

  async recordDecision(params: {
    suggestionId: string;
    user: AuthUser;
    decision: 'accepted' | 'edited' | 'rejected';
    humanEdit?: string;
    targetResourceType?: string;
    targetResourceId?: string;
    requestId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    try {
      await this.audit.writeFromUser(params.user, {
        action: `ai.suggestion.${params.decision}`,
        resourceType: params.targetResourceType ?? 'AISuggestion',
        resourceId: params.targetResourceId ?? params.suggestionId,
        after: {
          suggestionId: params.suggestionId,
          decision: params.decision,
          hasEdit: Boolean(params.humanEdit),
        },
        requestId: params.requestId,
        ip: params.ip,
        userAgent: params.userAgent,
      });
    } catch (err) {
      this.log.warn(`AI decision audit failed: ${(err as Error).message}`);
    }
  }

  async generateAmbientDraft(_visitId: string): Promise<AmbientDraft | null> {
    return null;
  }

  async getRiskScores(_patientId: string): Promise<RiskScore[]> {
    return [];
  }
}
