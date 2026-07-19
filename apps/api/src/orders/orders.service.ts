import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import {
  clinicalDocumentsMeta,
  episodes,
  orderPackages,
  organizations,
  patients,
  signatureRequests,
  type HhosDb,
} from '@hhos/db';
import type {
  CompleteOrderUploadInput,
  CreateOrderPackageInput,
  ProviderSignInput,
  RecordExternalSignInput,
  SendOrderPackageInput,
} from '@hhos/shared';
import { DB } from '../common/db.module';
import type { AuthUser } from '../common/auth.types';
import { fieldRnCanAccessEpisode, isFieldRnScoped } from '../common/caseload';
import { isOrdersEsignEnabled } from '../common/features';
import { AuditService } from '../audit/audit.service';
import {
  NotificationsService,
  shouldExposeTokens,
} from '../notifications/notifications.service';
import { ObjectStorageService } from '../storage/object-storage.service';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function patientInitialsFrom(first: string, last: string): string {
  const f = first?.trim()?.[0] ?? '?';
  const l = last?.trim()?.[0] ?? '?';
  return `${f}${l}`.toUpperCase();
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly audit: AuditService,
    private readonly storage: ObjectStorageService,
    private readonly notifications: NotificationsService,
  ) {}

  private async ensureFeature(user: AuthUser): Promise<void> {
    const [org] = await this.db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);
    if (!isOrdersEsignEnabled(org?.settings as never)) {
      throw new ServiceUnavailableException({
        error: {
          code: 'FEATURE_DISABLED',
          message: 'FEATURE_ORDERS_ESIGN is not enabled for this organization',
        },
      });
    }
  }

  private async assertEpisode(user: AuthUser, episodeId: string) {
    const [ep] = await this.db
      .select()
      .from(episodes)
      .where(
        and(
          eq(episodes.id, episodeId),
          eq(episodes.orgId, user.orgId),
          isNull(episodes.deletedAt),
        ),
      )
      .limit(1);
    if (!ep) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Episode not found' },
      });
    }
    if (isFieldRnScoped(user)) {
      const ok = await fieldRnCanAccessEpisode(this.db, user, episodeId);
      if (!ok) {
        throw new ForbiddenException({
          error: { code: 'NOT_ASSIGNED', message: 'Not on care team' },
        });
      }
    }
    return ep;
  }

  private async syncEpisodeStatuses(
    orgId: string,
    episodeId: string,
    docType: string,
    decision: 'signed' | 'rejected',
  ) {
    if (decision !== 'signed') return;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (docType === 'plan_of_care_485') {
      patch.pocStatus = 'signed';
      patch.ordersStatus = 'signed';
    } else if (
      docType === 'physician_order' ||
      docType === 'verbal_order' ||
      docType === 'f2f_encounter'
    ) {
      patch.ordersStatus = 'signed';
      if (docType === 'f2f_encounter') {
        patch.f2fStatus = 'completed';
      }
    }
    if (Object.keys(patch).length > 1) {
      await this.db
        .update(episodes)
        .set(patch)
        .where(and(eq(episodes.id, episodeId), eq(episodes.orgId, orgId)));
    }
  }

  async create(
    user: AuthUser,
    input: CreateOrderPackageInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const ep = await this.assertEpisode(user, input.episodeId);
    const patientId = input.patientId ?? ep.patientId;

    const [row] = await this.db
      .insert(orderPackages)
      .values({
        orgId: user.orgId,
        episodeId: ep.id,
        patientId,
        docType: input.docType,
        title: input.title,
        physicianName: input.physicianName,
        physicianNpi: input.physicianNpi ?? null,
        physicianEmail: input.physicianEmail?.toLowerCase() ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        notes: input.notes ?? null,
        status: 'draft',
        createdBy: user.id,
      })
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'order_package.create',
      resourceType: 'order_package',
      resourceId: row!.id,
      patientId,
      episodeId: ep.id,
      after: { docType: input.docType, title: input.title },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return row;
  }

  async list(
    user: AuthUser,
    query: { status?: string; episodeId?: string; page?: number; pageSize?: number },
  ) {
    await this.ensureFeature(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const conditions = [eq(orderPackages.orgId, user.orgId)];
    if (query.status) conditions.push(eq(orderPackages.status, query.status as never));
    if (query.episodeId) conditions.push(eq(orderPackages.episodeId, query.episodeId));

    const rows = await this.db
      .select()
      .from(orderPackages)
      .where(and(...conditions))
      .orderBy(desc(orderPackages.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { data: rows, page, pageSize };
  }

  async getById(user: AuthUser, id: string) {
    await this.ensureFeature(user);
    const [row] = await this.db
      .select()
      .from(orderPackages)
      .where(and(eq(orderPackages.id, id), eq(orderPackages.orgId, user.orgId)))
      .limit(1);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order package not found' },
      });
    }
    if (isFieldRnScoped(user)) {
      const ok = await fieldRnCanAccessEpisode(this.db, user, row.episodeId);
      if (!ok) {
        throw new ForbiddenException({
          error: { code: 'NOT_ASSIGNED', message: 'Not on care team' },
        });
      }
    }
    const requests = await this.db
      .select({
        id: signatureRequests.id,
        status: signatureRequests.status,
        sentToEmail: signatureRequests.sentToEmail,
        expiresAt: signatureRequests.expiresAt,
        sentAt: signatureRequests.sentAt,
        firstViewedAt: signatureRequests.firstViewedAt,
        decidedAt: signatureRequests.decidedAt,
        signerTypedName: signatureRequests.signerTypedName,
      })
      .from(signatureRequests)
      .where(eq(signatureRequests.orderPackageId, id))
      .orderBy(desc(signatureRequests.sentAt));

    return { ...row, signatureRequests: requests };
  }

  async initiateUpload(
    user: AuthUser,
    id: string,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const pkg = await this.getById(user, id);
    if (['signed', 'void', 'expired'].includes(pkg.status)) {
      throw new BadRequestException({
        error: { code: 'INVALID_STATUS', message: 'Cannot upload for this status' },
      });
    }
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'OBJECT_STORAGE_NOT_CONFIGURED',
          message: 'S3_ENDPOINT is not configured',
        },
      });
    }

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const key = `org/${user.orgId}/order-packages/${yyyy}/${mm}/${id}.pdf`;

    const presign = await this.storage.presignPut(key, {
      contentType: 'application/pdf',
    });

    await this.db
      .update(orderPackages)
      .set({ pendingStorageKey: key, updatedAt: new Date() })
      .where(eq(orderPackages.id, id));

    await this.audit.writeFromUser(user, {
      action: 'order_package.upload_initiate',
      resourceType: 'order_package',
      resourceId: id,
      patientId: pkg.patientId,
      episodeId: pkg.episodeId,
      after: { key },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      packageId: id,
      uploadUrl: presign.url,
      expiresAt: presign.expiresAt,
      storageKey: key,
      contentType: 'application/pdf',
    };
  }

  async completeUpload(
    user: AuthUser,
    id: string,
    input: CompleteOrderUploadInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const [pkg] = await this.db
      .select()
      .from(orderPackages)
      .where(and(eq(orderPackages.id, id), eq(orderPackages.orgId, user.orgId)))
      .limit(1);
    if (!pkg) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order package not found' },
      });
    }
    const key = pkg.pendingStorageKey;
    if (!key) {
      throw new BadRequestException({
        error: { code: 'NO_PENDING_UPLOAD', message: 'Call upload initiate first' },
      });
    }

    // Verify object exists when storage available
    if (this.storage.isConfigured()) {
      try {
        await this.storage.headObject(key);
      } catch {
        throw new BadRequestException({
          error: {
            code: 'OBJECT_MISSING',
            message: 'PDF not found in storage — complete PUT first',
          },
        });
      }
    }

    const [doc] = await this.db
      .insert(clinicalDocumentsMeta)
      .values({
        orgId: user.orgId,
        patientId: pkg.patientId,
        episodeId: pkg.episodeId,
        docType: pkg.docType,
        filename: input.filename,
        contentType: input.contentType,
        storageKey: key,
        sha256: input.sha256.toLowerCase(),
        uploadedBy: user.id,
      })
      .returning();

    const [updated] = await this.db
      .update(orderPackages)
      .set({
        documentMetaId: doc!.id,
        pendingStorageKey: null,
        status: pkg.status === 'draft' || pkg.status === 'ready' ? 'ready' : pkg.status,
        updatedAt: new Date(),
      })
      .where(eq(orderPackages.id, id))
      .returning();

    if (pkg.docType === 'plan_of_care_485') {
      await this.db
        .update(episodes)
        .set({ pocStatus: 'pending_signature', updatedAt: new Date() })
        .where(eq(episodes.id, pkg.episodeId));
    }

    await this.audit.writeFromUser(user, {
      action: 'order_package.upload_complete',
      resourceType: 'order_package',
      resourceId: id,
      patientId: pkg.patientId,
      episodeId: pkg.episodeId,
      after: { documentMetaId: doc!.id, sha256: input.sha256.slice(0, 8) + '…' },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  /**
   * Dev/demo path when S3 is awkward: mark package ready without object bytes.
   * Still requires explicit staff action; not a signature.
   */
  async markReadyWithoutFile(
    user: AuthUser,
    id: string,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const [pkg] = await this.db
      .select()
      .from(orderPackages)
      .where(and(eq(orderPackages.id, id), eq(orderPackages.orgId, user.orgId)))
      .limit(1);
    if (!pkg) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order package not found' },
      });
    }
    if (pkg.status !== 'draft' && pkg.status !== 'ready') {
      throw new BadRequestException({
        error: { code: 'INVALID_STATUS', message: 'Only draft packages can use stub ready' },
      });
    }
    const [updated] = await this.db
      .update(orderPackages)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(orderPackages.id, id))
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'order_package.mark_ready_stub',
      resourceType: 'order_package',
      resourceId: id,
      patientId: pkg.patientId,
      episodeId: pkg.episodeId,
      after: { stub: true },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      ...updated,
      warning:
        'Package marked ready without PDF (dev). Prefer upload+complete for production.',
    };
  }

  async send(
    user: AuthUser,
    id: string,
    input: SendOrderPackageInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const [pkg] = await this.db
      .select()
      .from(orderPackages)
      .where(and(eq(orderPackages.id, id), eq(orderPackages.orgId, user.orgId)))
      .limit(1);
    if (!pkg) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order package not found' },
      });
    }
    if (!['ready', 'sent', 'viewed', 'rejected'].includes(pkg.status)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_STATUS',
          message: 'Package must be ready (PDF attached or stub) before send',
        },
      });
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);

    const result = await this.db.transaction(async (tx) => {
      // revoke prior pending requests
      await tx
        .update(signatureRequests)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(signatureRequests.orderPackageId, id),
            inArray(signatureRequests.status, ['pending', 'viewed']),
          ),
        );

      const [req] = await tx
        .insert(signatureRequests)
        .values({
          orgId: user.orgId,
          orderPackageId: id,
          status: 'pending',
          tokenHash,
          sentToEmail: pkg.physicianEmail,
          noteToPhysician: input.noteToPhysician ?? null,
          expiresAt,
          sentBy: user.id,
        })
        .returning();

      const [updated] = await tx
        .update(orderPackages)
        .set({ status: 'sent', updatedAt: new Date() })
        .where(eq(orderPackages.id, id))
        .returning();

      if (pkg.docType === 'plan_of_care_485') {
        await tx
          .update(episodes)
          .set({ pocStatus: 'pending_signature', updatedAt: new Date() })
          .where(eq(episodes.id, pkg.episodeId));
      }

      await this.audit.writeFromUser(
        user,
        {
          action: 'order_package.send',
          resourceType: 'order_package',
          resourceId: id,
          patientId: pkg.patientId,
          episodeId: pkg.episodeId,
          after: {
            signatureRequestId: req!.id,
            expiresAt: expiresAt.toISOString(),
            sentToEmail: pkg.physicianEmail,
          },
          requestId: meta.requestId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );

      return { package: updated!, request: req! };
    });

    const webBase =
      process.env.WEB_PUBLIC_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
    const signUrl = `${webBase}/sign/${rawToken}`;

    const [org] = await this.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);

    let patientInitials: string | undefined;
    let dobYear: number | null = null;
    if (pkg.patientId) {
      const [p] = await this.db
        .select({
          firstName: patients.firstName,
          lastName: patients.lastName,
          dob: patients.dob,
        })
        .from(patients)
        .where(eq(patients.id, pkg.patientId))
        .limit(1);
      if (p) {
        patientInitials = patientInitialsFrom(p.firstName, p.lastName);
        if (p.dob) {
          const y = Number(String(p.dob).slice(0, 4));
          dobYear = Number.isFinite(y) ? y : null;
        }
      }
    }

    const physicianEmail = pkg.physicianEmail?.trim();
    if (!physicianEmail) {
      throw new BadRequestException({
        error: {
          code: 'PHYSICIAN_EMAIL_REQUIRED',
          message: 'Package needs physicianEmail before send',
        },
      });
    }

    const delivery = await this.notifications.sendPhysicianSign({
      orgId: user.orgId,
      signatureRequestId: result.request.id,
      to: physicianEmail,
      orgName: org?.name ?? 'HHOS agency',
      docType: pkg.docType,
      physicianName: pkg.physicianName,
      patientInitials,
      dobYear,
      rawToken,
      expiresAt,
      actorUserId: user.id,
    });

    const expose = shouldExposeTokens() || delivery.status === 'failed';
    return {
      package: result.package,
      signatureRequestId: result.request.id,
      expiresAt: result.request.expiresAt,
      delivery,
      ...(expose
        ? {
            signUrl,
            signToken: rawToken,
            note:
              delivery.status === 'failed'
                ? 'Email delivery failed — share signUrl with the provider.'
                : 'Local/console mode — share signUrl with the provider.',
          }
        : {
            note: `Sign link email ${delivery.status} via ${this.notifications.providerName()}.`,
          }),
    };
  }

  async voidPackage(
    user: AuthUser,
    id: string,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const [pkg] = await this.db
      .select()
      .from(orderPackages)
      .where(and(eq(orderPackages.id, id), eq(orderPackages.orgId, user.orgId)))
      .limit(1);
    if (!pkg) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order package not found' },
      });
    }
    if (pkg.status === 'signed') {
      throw new BadRequestException({
        error: { code: 'ALREADY_SIGNED', message: 'Cannot void a signed package' },
      });
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(orderPackages)
        .set({
          status: 'void',
          voidedAt: new Date(),
          voidedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(orderPackages.id, id));
      await tx
        .update(signatureRequests)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(signatureRequests.orderPackageId, id),
            inArray(signatureRequests.status, ['pending', 'viewed']),
          ),
        );
      await this.audit.writeFromUser(
        user,
        {
          action: 'order_package.void',
          resourceType: 'order_package',
          resourceId: id,
          patientId: pkg.patientId,
          episodeId: pkg.episodeId,
          requestId: meta.requestId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );
    });

    return this.getById(user, id);
  }

  async recordExternalSign(
    user: AuthUser,
    id: string,
    input: RecordExternalSignInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    await this.ensureFeature(user);
    const [pkg] = await this.db
      .select()
      .from(orderPackages)
      .where(and(eq(orderPackages.id, id), eq(orderPackages.orgId, user.orgId)))
      .limit(1);
    if (!pkg) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order package not found' },
      });
    }
    if (['signed', 'void'].includes(pkg.status)) {
      throw new BadRequestException({
        error: { code: 'INVALID_STATUS', message: 'Package already closed' },
      });
    }

    const signedAt = input.signedAt ? new Date(input.signedAt) : new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(orderPackages)
        .set({
          status: 'signed',
          signedAt,
          signedByName: input.signerTypedName,
          signatureMethod: input.method,
          notes: input.note
            ? `${pkg.notes ? pkg.notes + '\n' : ''}External: ${input.note}`
            : pkg.notes,
          updatedAt: new Date(),
        })
        .where(eq(orderPackages.id, id));

      await tx
        .update(signatureRequests)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(signatureRequests.orderPackageId, id),
            inArray(signatureRequests.status, ['pending', 'viewed']),
          ),
        );

      await this.audit.writeFromUser(
        user,
        {
          action: 'order_package.external_sign',
          resourceType: 'order_package',
          resourceId: id,
          patientId: pkg.patientId,
          episodeId: pkg.episodeId,
          after: { method: input.method, signerTypedName: input.signerTypedName },
          requestId: meta.requestId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );
    });

    await this.syncEpisodeStatuses(user.orgId, pkg.episodeId, pkg.docType, 'signed');
    return this.getById(user, id);
  }

  async worklist(user: AuthUser) {
    await this.ensureFeature(user);
    const rows = await this.db
      .select({
        package: orderPackages,
        patientFirst: patients.firstName,
        patientLast: patients.lastName,
      })
      .from(orderPackages)
      .innerJoin(patients, eq(patients.id, orderPackages.patientId))
      .where(
        and(
          eq(orderPackages.orgId, user.orgId),
          inArray(orderPackages.status, ['draft', 'ready', 'sent', 'viewed', 'rejected']),
        ),
      )
      .orderBy(desc(orderPackages.dueAt), desc(orderPackages.updatedAt))
      .limit(100);

    return {
      data: rows.map((r) => ({
        ...r.package,
        patientLabel: `${patientInitialsFrom(r.patientFirst, r.patientLast)}`,
        overdue:
          r.package.dueAt != null &&
          r.package.dueAt.getTime() < Date.now() &&
          !['signed', 'void'].includes(r.package.status),
      })),
      hitlRequired: true,
      disclaimer:
        'Unsigned orders/485 block clean billing. Chase physicians; system never auto-signs.',
    };
  }

  // ── Public provider sign flow ────────────────────────────────────────────

  private async loadByToken(token: string) {
    const tokenHash = sha256(token);
    const [row] = await this.db
      .select({
        request: signatureRequests,
        pkg: orderPackages,
        orgName: organizations.name,
        patientFirst: patients.firstName,
        patientLast: patients.lastName,
        patientDob: patients.dob,
      })
      .from(signatureRequests)
      .innerJoin(orderPackages, eq(orderPackages.id, signatureRequests.orderPackageId))
      .innerJoin(organizations, eq(organizations.id, signatureRequests.orgId))
      .innerJoin(patients, eq(patients.id, orderPackages.patientId))
      .where(eq(signatureRequests.tokenHash, tokenHash))
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Signature link not found' },
      });
    }
    return row;
  }

  async peekSign(token: string) {
    const row = await this.loadByToken(token);
    if (['revoked', 'expired'].includes(row.request.status)) {
      throw new BadRequestException({
        error: { code: 'LINK_INVALID', message: `Link is ${row.request.status}` },
      });
    }
    if (row.request.expiresAt.getTime() < Date.now()) {
      await this.db
        .update(signatureRequests)
        .set({ status: 'expired' })
        .where(eq(signatureRequests.id, row.request.id));
      await this.db
        .update(orderPackages)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(
          and(
            eq(orderPackages.id, row.pkg.id),
            ne(orderPackages.status, 'signed'),
          ),
        );
      throw new BadRequestException({
        error: { code: 'LINK_EXPIRED', message: 'Signature link has expired' },
      });
    }

    if (row.request.status === 'pending') {
      await this.db
        .update(signatureRequests)
        .set({ status: 'viewed', firstViewedAt: new Date() })
        .where(eq(signatureRequests.id, row.request.id));
      if (row.pkg.status === 'sent') {
        await this.db
          .update(orderPackages)
          .set({ status: 'viewed', updatedAt: new Date() })
          .where(eq(orderPackages.id, row.pkg.id));
      }
      await this.audit.write({
        orgId: row.pkg.orgId,
        actorType: 'system',
        action: 'order_package.sign_viewed',
        resourceType: 'order_package',
        resourceId: row.pkg.id,
        patientId: row.pkg.patientId,
        episodeId: row.pkg.episodeId,
      });
    }

    const dobYear =
      typeof row.patientDob === 'string'
        ? row.patientDob.slice(0, 4)
        : row.patientDob
          ? String(row.patientDob).slice(0, 4)
          : null;

    return {
      organizationName: row.orgName,
      docType: row.pkg.docType,
      title: row.pkg.title,
      physicianName: row.pkg.physicianName,
      patientInitials: patientInitialsFrom(row.patientFirst, row.patientLast),
      patientDobYear: dobYear,
      noteToPhysician: row.request.noteToPhysician,
      status: row.request.status === 'pending' ? 'viewed' : row.request.status,
      expiresAt: row.request.expiresAt,
      alreadyDecided: ['signed', 'rejected'].includes(row.request.status),
      disclaimer:
        'By signing you attest you are the named provider or authorized NPP for this order/plan of care.',
    };
  }

  async providerSign(
    token: string,
    input: ProviderSignInput,
    meta: { ip?: string; userAgent?: string },
  ) {
    const row = await this.loadByToken(token);
    if (!['pending', 'viewed'].includes(row.request.status)) {
      throw new BadRequestException({
        error: {
          code: 'ALREADY_DECIDED',
          message: `Request is ${row.request.status}`,
        },
      });
    }
    if (row.request.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        error: { code: 'LINK_EXPIRED', message: 'Signature link has expired' },
      });
    }
    if (input.decision === 'rejected' && !input.rejectReason) {
      throw new BadRequestException({
        error: { code: 'REJECT_REASON_REQUIRED', message: 'rejectReason required' },
      });
    }

    const decidedAt = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(signatureRequests)
        .set({
          status: input.decision,
          decidedAt,
          signerTypedName: input.signerTypedName,
          signerCredentials: input.signerCredentials ?? null,
          signerIp: meta.ip ?? null,
          signerUserAgent: meta.userAgent ?? null,
        })
        .where(eq(signatureRequests.id, row.request.id));

      await tx
        .update(orderPackages)
        .set({
          status: input.decision,
          signedAt: input.decision === 'signed' ? decidedAt : null,
          signedByName: input.decision === 'signed' ? input.signerTypedName : null,
          signatureMethod: input.decision === 'signed' ? 'esign_portal' : null,
          rejectReason: input.decision === 'rejected' ? input.rejectReason ?? null : null,
          updatedAt: decidedAt,
        })
        .where(eq(orderPackages.id, row.pkg.id));

      await this.audit.write(
        {
          orgId: row.pkg.orgId,
          actorType: 'system',
          action:
            input.decision === 'signed'
              ? 'order_package.signed'
              : 'order_package.rejected',
          resourceType: 'order_package',
          resourceId: row.pkg.id,
          patientId: row.pkg.patientId,
          episodeId: row.pkg.episodeId,
          after: {
            signerTypedName: input.signerTypedName,
            method: 'esign_portal',
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );
    });

    if (input.decision === 'signed') {
      await this.syncEpisodeStatuses(
        row.pkg.orgId,
        row.pkg.episodeId,
        row.pkg.docType,
        'signed',
      );
    }

    return {
      ok: true,
      decision: input.decision,
      message:
        input.decision === 'signed'
          ? 'Thank you. Signature recorded for the agency medical record.'
          : 'Rejection recorded. The agency will follow up.',
    };
  }
}
