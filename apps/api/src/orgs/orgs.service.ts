import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, ne } from 'drizzle-orm';
import {
  DEFAULT_ORG_SETTINGS,
  permissionsForRoles,
  type AcceptInviteInput,
  type CreateOrganizationInput,
  type InviteUserInput,
  type RoleCode,
  type UpdateOrgSettingsInput,
} from '@hhos/shared';
import {
  orgInvites,
  organizations,
  roles,
  userRoles,
  users,
  type HhosDb,
  type OrgSettingsJson,
} from '@hhos/db';
import * as jwt from 'jsonwebtoken';
import { DB } from '../common/db.module';
import type { AuthUser } from '../common/auth.types';
import { AuditService } from '../audit/audit.service';
import {
  NotificationsService,
  shouldExposeTokens,
} from '../notifications/notifications.service';
import { bootstrapOrgRoles, ensureGlobalPermissions } from './org-bootstrap';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function issueToken(user: {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  roles: RoleCode[];
}) {
  const permissions = [...permissionsForRoles(user.roles)];
  const secret = process.env.JWT_SECRET ?? 'dev-only-change-me-not-for-prod';
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '8h';
  const accessToken = jwt.sign(
    {
      sub: user.id,
      orgId: user.orgId,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles,
      permissions,
    },
    secret,
    { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] },
  );
  return {
    accessToken,
    tokenType: 'Bearer' as const,
    user: {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles,
      permissions,
    },
  };
}

@Injectable()
export class OrgsService {
  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async getOrgSettings(orgId: string): Promise<OrgSettingsJson> {
    const [org] = await this.db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    return (org?.settings ?? {}) as OrgSettingsJson;
  }

  async createOrganization(
    input: CreateOrganizationInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    const email = input.adminEmail.toLowerCase().trim();
    const slug = input.slug.toLowerCase().trim();

    const [slugTaken] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (slugTaken) {
      throw new ConflictException({
        error: { code: 'SLUG_TAKEN', message: 'Organization slug already in use' },
      });
    }

    const settings: OrgSettingsJson = {
      ...DEFAULT_ORG_SETTINGS,
      features: { ...DEFAULT_ORG_SETTINGS.features },
    };

    const result = await this.db.transaction(async (tx) => {
      const db = tx as unknown as HhosDb;
      const [org] = await db
        .insert(organizations)
        .values({
          name: input.name.trim(),
          slug,
          npi: input.npi ?? null,
          timezone: input.timezone,
          settings,
        })
        .returning();
      if (!org) throw new Error('org insert failed');

      const permByCode = await ensureGlobalPermissions(db);
      const roleIds = await bootstrapOrgRoles(db, org.id, permByCode);
      const adminRoleId = roleIds.get('admin');
      if (!adminRoleId) {
        throw new Error('admin role missing after bootstrap');
      }

      const [admin] = await db
        .insert(users)
        .values({
          orgId: org.id,
          email,
          fullName: input.adminFullName.trim(),
          status: 'active',
          cognitoSub: `local-${org.id}-${email}`,
        })
        .returning();
      if (!admin) throw new Error('admin insert failed');

      await db.insert(userRoles).values({
        userId: admin.id,
        roleId: adminRoleId,
      });

      await this.audit.write(
        {
          orgId: org.id,
          actorUserId: admin.id,
          action: 'org.create',
          resourceType: 'organization',
          resourceId: org.id,
          after: { slug: org.slug, name: org.name },
          requestId: meta.requestId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );

      return { org, admin };
    });

    return {
      organization: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
        timezone: result.org.timezone,
        npi: result.org.npi,
        settings: result.org.settings,
      },
      ...issueToken({
        id: result.admin.id,
        orgId: result.org.id,
        email: result.admin.email,
        fullName: result.admin.fullName,
        roles: ['admin'],
      }),
    };
  }

  async getMyOrg(user: AuthUser) {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);
    if (!org) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      timezone: org.timezone,
      npi: org.npi,
      settings: org.settings,
      createdAt: org.createdAt,
    };
  }

  async updateMyOrg(
    user: AuthUser,
    input: UpdateOrgSettingsInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);
    if (!org) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    const prev = (org.settings ?? {}) as OrgSettingsJson;
    const nextSettings: OrgSettingsJson = {
      ...prev,
      ...(input.socDueHours !== undefined ? { socDueHours: input.socDueHours } : {}),
      ...(input.photoGeotagEnabled !== undefined
        ? { photoGeotagEnabled: input.photoGeotagEnabled }
        : {}),
      ...(input.coverageVerifiedRequired !== undefined
        ? { coverageVerifiedRequired: input.coverageVerifiedRequired }
        : {}),
      ...(input.woundPathwayDefault !== undefined
        ? { woundPathwayDefault: input.woundPathwayDefault }
        : {}),
      ...(input.largeWoundLengthCm !== undefined
        ? { largeWoundLengthCm: input.largeWoundLengthCm }
        : {}),
      ...(input.largeWoundWidthCm !== undefined
        ? { largeWoundWidthCm: input.largeWoundWidthCm }
        : {}),
      ...(input.largeWoundAreaCm2 !== undefined
        ? { largeWoundAreaCm2: input.largeWoundAreaCm2 }
        : {}),
      ...(input.photoMaxBytes !== undefined ? { photoMaxBytes: input.photoMaxBytes } : {}),
      ...(input.photoPendingTtlHours !== undefined
        ? { photoPendingTtlHours: input.photoPendingTtlHours }
        : {}),
      features: {
        ...(prev.features ?? {}),
        ...(input.features ?? {}),
      },
    };

    const patch: Partial<typeof organizations.$inferInsert> = {
      settings: nextSettings,
    };
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.timezone !== undefined) patch.timezone = input.timezone;
    if (input.npi !== undefined) patch.npi = input.npi;

    const [updated] = await this.db
      .update(organizations)
      .set(patch)
      .where(eq(organizations.id, user.orgId))
      .returning();

    await this.audit.writeFromUser(user, {
      action: 'org.update',
      resourceType: 'organization',
      resourceId: user.orgId,
      before: { name: org.name, settings: prev },
      after: {
        name: updated!.name,
        settings: {
          ...nextSettings,
          // no PHI in settings
        },
      },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      id: updated!.id,
      name: updated!.name,
      slug: updated!.slug,
      timezone: updated!.timezone,
      npi: updated!.npi,
      settings: updated!.settings,
    };
  }

  async listMembers(user: AuthUser) {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        status: users.status,
        createdAt: users.createdAt,
        roleCode: roles.code,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(users.orgId, user.orgId))
      .orderBy(desc(users.createdAt));

    // Collapse multi-role into arrays
    const byId = new Map<
      string,
      {
        id: string;
        email: string;
        fullName: string;
        status: string;
        createdAt: Date;
        roles: string[];
      }
    >();
    for (const r of rows) {
      const cur = byId.get(r.id);
      if (!cur) {
        byId.set(r.id, {
          id: r.id,
          email: r.email,
          fullName: r.fullName,
          status: r.status,
          createdAt: r.createdAt,
          roles: r.roleCode ? [r.roleCode] : [],
        });
      } else if (r.roleCode && !cur.roles.includes(r.roleCode)) {
        cur.roles.push(r.roleCode);
      }
    }
    return { data: [...byId.values()] };
  }

  async invite(
    user: AuthUser,
    input: InviteUserInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    if (input.roleCode === 'admin' && !user.roles.includes('admin')) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Only org admins can invite other admins',
        },
      });
    }

    const email = input.email.toLowerCase().trim();
    const [existing] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.orgId, user.orgId), eq(users.email, email)))
      .limit(1);
    if (existing && existing.status === 'active') {
      throw new ConflictException({
        error: { code: 'USER_EXISTS', message: 'User already active in this org' },
      });
    }

    const [role] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.orgId, user.orgId), eq(roles.code, input.roleCode)))
      .limit(1);
    if (!role) {
      // bootstrap roles if org was created before multi-tenant tooling
      await bootstrapOrgRoles(this.db, user.orgId);
      const [again] = await this.db
        .select()
        .from(roles)
        .where(and(eq(roles.orgId, user.orgId), eq(roles.code, input.roleCode)))
        .limit(1);
      if (!again) {
        throw new BadRequestException({
          error: { code: 'ROLE_MISSING', message: 'Role not configured for org' },
        });
      }
    }

    const roleRow =
      role ??
      (
        await this.db
          .select()
          .from(roles)
          .where(and(eq(roles.orgId, user.orgId), eq(roles.code, input.roleCode)))
          .limit(1)
      )[0]!;

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);

    const invited = await this.db.transaction(async (tx) => {
      let userId = existing?.id;
      if (!userId) {
        const [created] = await tx
          .insert(users)
          .values({
            orgId: user.orgId,
            email,
            fullName: input.fullName.trim(),
            status: 'invited',
            cognitoSub: `invite-${user.orgId}-${email}`,
          })
          .returning();
        userId = created!.id;
      } else {
        await tx
          .update(users)
          .set({ fullName: input.fullName.trim(), status: 'invited' })
          .where(eq(users.id, userId));
      }

      // Reset roles to invited role
      await tx.delete(userRoles).where(eq(userRoles.userId, userId));
      await tx.insert(userRoles).values({ userId, roleId: roleRow.id });

      // Revoke prior pending invites for same email
      await tx
        .update(orgInvites)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(orgInvites.orgId, user.orgId),
            eq(orgInvites.email, email),
            eq(orgInvites.status, 'pending'),
          ),
        );

      const [invite] = await tx
        .insert(orgInvites)
        .values({
          orgId: user.orgId,
          email,
          fullName: input.fullName.trim(),
          roleCode: input.roleCode,
          status: 'pending',
          tokenHash,
          invitedUserId: userId,
          invitedBy: user.id,
          expiresAt,
        })
        .returning();

      await this.audit.writeFromUser(
        user,
        {
          action: 'org.invite',
          resourceType: 'org_invite',
          resourceId: invite!.id,
          after: { email, roleCode: input.roleCode, expiresAt: expiresAt.toISOString() },
          requestId: meta.requestId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );

      return invite!;
    });

    const [org] = await this.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);

    const delivery = await this.notifications.sendOrgInvite({
      orgId: user.orgId,
      inviteId: invited.id,
      to: email,
      orgName: org?.name ?? 'HHOS agency',
      roleCode: invited.roleCode,
      rawToken,
      expiresAt,
      actorUserId: user.id,
    });

    const expose = shouldExposeTokens() || delivery.status === 'failed';
    return {
      invite: {
        id: invited.id,
        email: invited.email,
        fullName: invited.fullName,
        roleCode: invited.roleCode,
        status: invited.status,
        expiresAt: invited.expiresAt,
      },
      delivery,
      ...(expose
        ? {
            inviteToken: rawToken,
            note:
              delivery.status === 'failed'
                ? 'Email delivery failed — copy inviteToken to Accept invite page.'
                : 'Local/console mode — copy inviteToken to Accept invite page.',
          }
        : {
            note: `Invite email ${delivery.status} via ${this.notifications.providerName()}.`,
          }),
      acceptPath: `/v1/invites/accept`,
    };
  }

  /** Rotate token and re-send invite email. */
  async resendInvite(
    user: AuthUser,
    inviteId: string,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    const [row] = await this.db
      .select()
      .from(orgInvites)
      .where(and(eq(orgInvites.id, inviteId), eq(orgInvites.orgId, user.orgId)))
      .limit(1);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Invite not found' },
      });
    }
    if (row.status !== 'pending') {
      throw new BadRequestException({
        error: { code: 'INVITE_NOT_PENDING', message: `Invite is ${row.status}` },
      });
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await this.db
      .update(orgInvites)
      .set({ tokenHash, expiresAt })
      .where(eq(orgInvites.id, inviteId));

    const [org] = await this.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);

    const delivery = await this.notifications.sendOrgInvite({
      orgId: user.orgId,
      inviteId,
      to: row.email,
      orgName: org?.name ?? 'HHOS agency',
      roleCode: row.roleCode,
      rawToken,
      expiresAt,
      actorUserId: user.id,
    });

    await this.audit.writeFromUser(user, {
      action: 'org.invite.resend',
      resourceType: 'org_invite',
      resourceId: inviteId,
      after: { deliveryId: delivery.id, status: delivery.status },
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const expose = shouldExposeTokens() || delivery.status === 'failed';
    return {
      invite: {
        id: row.id,
        email: row.email,
        fullName: row.fullName,
        roleCode: row.roleCode,
        status: row.status,
        expiresAt,
      },
      delivery,
      ...(expose ? { inviteToken: rawToken } : {}),
    };
  }

  async listInvites(user: AuthUser) {
    const rows = await this.db
      .select({
        id: orgInvites.id,
        email: orgInvites.email,
        fullName: orgInvites.fullName,
        roleCode: orgInvites.roleCode,
        status: orgInvites.status,
        expiresAt: orgInvites.expiresAt,
        createdAt: orgInvites.createdAt,
        acceptedAt: orgInvites.acceptedAt,
      })
      .from(orgInvites)
      .where(and(eq(orgInvites.orgId, user.orgId), ne(orgInvites.status, 'revoked')))
      .orderBy(desc(orgInvites.createdAt))
      .limit(100);
    return { data: rows };
  }

  async peekInvite(token: string) {
    const tokenHash = sha256(token);
    const [row] = await this.db
      .select({
        invite: orgInvites,
        orgName: organizations.name,
        orgSlug: organizations.slug,
      })
      .from(orgInvites)
      .innerJoin(organizations, eq(organizations.id, orgInvites.orgId))
      .where(eq(orgInvites.tokenHash, tokenHash))
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Invite not found' },
      });
    }
    if (row.invite.status !== 'pending') {
      throw new BadRequestException({
        error: { code: 'INVITE_NOT_PENDING', message: `Invite is ${row.invite.status}` },
      });
    }
    if (row.invite.expiresAt.getTime() < Date.now()) {
      await this.db
        .update(orgInvites)
        .set({ status: 'expired' })
        .where(eq(orgInvites.id, row.invite.id));
      throw new BadRequestException({
        error: { code: 'INVITE_EXPIRED', message: 'Invite has expired' },
      });
    }

    return {
      email: row.invite.email,
      fullName: row.invite.fullName,
      roleCode: row.invite.roleCode,
      organization: { name: row.orgName, slug: row.orgSlug },
      expiresAt: row.invite.expiresAt,
    };
  }

  async acceptInvite(
    input: AcceptInviteInput,
    meta: { requestId?: string; ip?: string; userAgent?: string },
  ) {
    const tokenHash = sha256(input.token);
    const [row] = await this.db
      .select()
      .from(orgInvites)
      .where(eq(orgInvites.tokenHash, tokenHash))
      .limit(1);

    if (!row || row.status !== 'pending') {
      throw new UnauthorizedException({
        error: { code: 'INVALID_INVITE', message: 'Invite invalid or already used' },
      });
    }
    if (row.expiresAt.getTime() < Date.now()) {
      await this.db
        .update(orgInvites)
        .set({ status: 'expired' })
        .where(eq(orgInvites.id, row.id));
      throw new UnauthorizedException({
        error: { code: 'INVITE_EXPIRED', message: 'Invite has expired' },
      });
    }
    if (!row.invitedUserId) {
      throw new BadRequestException({
        error: { code: 'INVITE_CORRUPT', message: 'Invite missing user' },
      });
    }

    const [member] = await this.db.transaction(async (tx) => {
      await tx
        .update(orgInvites)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(eq(orgInvites.id, row.id));

      const [u] = await tx
        .update(users)
        .set({
          status: 'active',
          fullName: input.fullName?.trim() || row.fullName,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, row.invitedUserId!))
        .returning();

      await this.audit.write(
        {
          orgId: row.orgId,
          actorUserId: row.invitedUserId,
          action: 'org.invite.accept',
          resourceType: 'org_invite',
          resourceId: row.id,
          after: { email: row.email, roleCode: row.roleCode },
          requestId: meta.requestId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx as never,
      );

      return [u];
    });

    const roleRows = await this.db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, member!.id));

    return issueToken({
      id: member!.id,
      orgId: member!.orgId,
      email: member!.email,
      fullName: member!.fullName,
      roles: roleRows.map((r) => r.code as RoleCode),
    });
  }
}
