import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { notificationDeliveries, type HhosDb } from '@hhos/db';
import { DB } from '../common/db.module';
import { featureEnabled } from '../common/features';
import { log } from '../common/logger';
import { AuditService } from '../audit/audit.service';
import { EMAIL_PROVIDER, type EmailProvider } from './providers/email-provider';
import { buildOrgInviteEmail, roleLabel } from './templates/invite';
import {
  buildPhysicianSignEmail,
  docTypeLabel,
} from './templates/physician-sign';

export type DeliverySummary = {
  id: string;
  status: 'pending' | 'sent' | 'failed' | 'suppressed';
  channel: 'email' | 'sms';
};

function webBase(): string {
  return process.env.WEB_PUBLIC_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
}

/** Expose raw tokens in API responses for local/console DX. */
export function shouldExposeTokens(): boolean {
  if (process.env.EMAIL_EXPOSE_TOKEN === 'true') return true;
  const env = (process.env.HHOS_ENV ?? process.env.NODE_ENV ?? 'local').toLowerCase();
  if (env === 'staging' || env === 'production' || env === 'prod') return false;
  const provider = (process.env.EMAIL_PROVIDER ?? 'console').toLowerCase();
  return provider === 'console';
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    private readonly audit: AuditService,
  ) {}

  providerName(): string {
    return this.email.name;
  }

  private notificationsKillSwitch(): boolean {
    return featureEnabled('FEATURE_NOTIFICATIONS', true) === false;
  }

  async sendOrgInvite(input: {
    orgId: string;
    inviteId: string;
    to: string;
    orgName: string;
    roleCode: string;
    rawToken: string;
    expiresAt: Date;
    actorUserId?: string;
  }): Promise<DeliverySummary> {
    const acceptUrl = `${webBase()}/invite?token=${encodeURIComponent(input.rawToken)}`;
    const tpl = buildOrgInviteEmail({
      orgName: input.orgName,
      roleLabel: roleLabel(input.roleCode),
      acceptUrl,
      expiresAt: input.expiresAt,
    });

    return this.dispatch({
      orgId: input.orgId,
      template: 'org_invite',
      to: input.to,
      subject: tpl.subject,
      textBody: tpl.textBody,
      relatedType: 'org_invite',
      relatedId: input.inviteId,
      actorUserId: input.actorUserId,
    });
  }

  async sendPhysicianSign(input: {
    orgId: string;
    signatureRequestId: string;
    to: string;
    orgName: string;
    docType: string;
    physicianName: string;
    patientInitials?: string;
    dobYear?: string | number | null;
    rawToken: string;
    expiresAt: Date;
    actorUserId?: string;
  }): Promise<DeliverySummary> {
    const signUrl = `${webBase()}/sign/${input.rawToken}`;
    const tpl = buildPhysicianSignEmail({
      orgName: input.orgName,
      docTypeLabel: docTypeLabel(input.docType),
      signUrl,
      expiresAt: input.expiresAt,
      physicianName: input.physicianName,
      patientInitials: input.patientInitials,
      dobYear: input.dobYear,
    });

    return this.dispatch({
      orgId: input.orgId,
      template: 'physician_sign',
      to: input.to,
      subject: tpl.subject,
      textBody: tpl.textBody,
      relatedType: 'signature_request',
      relatedId: input.signatureRequestId,
      actorUserId: input.actorUserId,
    });
  }

  private async dispatch(input: {
    orgId: string;
    template: string;
    to: string;
    subject: string;
    textBody: string;
    relatedType: string;
    relatedId: string;
    actorUserId?: string;
  }): Promise<DeliverySummary> {
    const [row] = await this.db
      .insert(notificationDeliveries)
      .values({
        orgId: input.orgId,
        channel: 'email',
        template: input.template,
        toAddress: input.to,
        status: 'pending',
        provider: this.email.name,
        attemptCount: 0,
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      })
      .returning();

    const deliveryId = row!.id;

    if (this.notificationsKillSwitch()) {
      await this.db
        .update(notificationDeliveries)
        .set({
          status: 'suppressed',
          lastErrorCode: 'FEATURE_NOTIFICATIONS_OFF',
          attemptCount: 1,
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveries.id, deliveryId));
      return { id: deliveryId, status: 'suppressed', channel: 'email' };
    }

    try {
      const result = await this.email.send({
        to: input.to,
        subject: input.subject,
        textBody: input.textBody,
        tags: {
          orgId: input.orgId,
          template: input.template,
          deliveryId,
        },
      });

      await this.db
        .update(notificationDeliveries)
        .set({
          status: 'sent',
          providerMessageId: result.providerMessageId,
          attemptCount: 1,
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveries.id, deliveryId));

      await this.audit.write({
        orgId: input.orgId,
        actorUserId: input.actorUserId ?? null,
        action: 'notification.send',
        resourceType: 'notification_delivery',
        resourceId: deliveryId,
        after: {
          template: input.template,
          provider: this.email.name,
          relatedType: input.relatedType,
          relatedId: input.relatedId,
        },
      });

      return { id: deliveryId, status: 'sent', channel: 'email' };
    } catch (e) {
      const code = e instanceof Error ? e.name || 'SEND_FAILED' : 'SEND_FAILED';
      await this.db
        .update(notificationDeliveries)
        .set({
          status: 'failed',
          lastErrorCode: code.slice(0, 64),
          attemptCount: 1,
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveries.id, deliveryId));

      log.warn('notification_send_failed', {
        deliveryId,
        template: input.template,
        code,
      });

      await this.audit.write({
        orgId: input.orgId,
        actorUserId: input.actorUserId ?? null,
        action: 'notification.fail',
        resourceType: 'notification_delivery',
        resourceId: deliveryId,
        after: {
          template: input.template,
          provider: this.email.name,
          code,
        },
      });

      return { id: deliveryId, status: 'failed', channel: 'email' };
    }
  }
}
