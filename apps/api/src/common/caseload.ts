import { and, eq, inArray } from 'drizzle-orm';
import { careTeamMembers, episodes, type HhosDb } from '@hhos/db';
import type { AuthUser } from './auth.types';

/**
 * field_rn is caseload-scoped: may only access episodes/patients where they are
 * an active care team member. Other roles have org-wide access within RBAC.
 */
export function isFieldRnScoped(user: AuthUser): boolean {
  return (
    user.roles.includes('field_rn') &&
    !user.roles.some((r) =>
      ['admin', 'intake_coordinator', 'clinical_lead', 'compliance', 'billing'].includes(
        r,
      ),
    )
  );
}

export async function isOnCareTeam(
  db: HhosDb,
  episodeId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: careTeamMembers.id })
    .from(careTeamMembers)
    .where(
      and(
        eq(careTeamMembers.episodeId, episodeId),
        eq(careTeamMembers.userId, userId),
        eq(careTeamMembers.active, true),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function fieldRnCanAccessEpisode(
  db: HhosDb,
  user: AuthUser,
  episodeId: string,
): Promise<boolean> {
  if (!isFieldRnScoped(user)) return true;
  return isOnCareTeam(db, episodeId, user.id);
}

export async function fieldRnCanAccessPatient(
  db: HhosDb,
  user: AuthUser,
  patientId: string,
): Promise<boolean> {
  if (!isFieldRnScoped(user)) return true;

  const rows = await db
    .select({ episodeId: careTeamMembers.episodeId })
    .from(careTeamMembers)
    .innerJoin(episodes, eq(careTeamMembers.episodeId, episodes.id))
    .where(
      and(
        eq(episodes.patientId, patientId),
        eq(careTeamMembers.userId, user.id),
        eq(careTeamMembers.active, true),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/** Single-query caseload patient id set for list filtering. */
export async function caseloadPatientIdSet(
  db: HhosDb,
  userId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ patientId: episodes.patientId })
    .from(careTeamMembers)
    .innerJoin(episodes, eq(careTeamMembers.episodeId, episodes.id))
    .where(
      and(eq(careTeamMembers.userId, userId), eq(careTeamMembers.active, true)),
    );
  return new Set(rows.map((r) => r.patientId));
}

/** Single-query caseload episode id set for list filtering. */
export async function caseloadEpisodeIdSet(
  db: HhosDb,
  userId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ episodeId: careTeamMembers.episodeId })
    .from(careTeamMembers)
    .where(
      and(eq(careTeamMembers.userId, userId), eq(careTeamMembers.active, true)),
    );
  return new Set(rows.map((r) => r.episodeId));
}

/** Filter list of ids to those on caseload (no-op if not field_rn scoped). */
export async function filterIdsOnCaseloadEpisodes(
  db: HhosDb,
  user: AuthUser,
  episodeIds: string[],
): Promise<string[]> {
  if (!isFieldRnScoped(user) || episodeIds.length === 0) return episodeIds;
  const rows = await db
    .select({ episodeId: careTeamMembers.episodeId })
    .from(careTeamMembers)
    .where(
      and(
        eq(careTeamMembers.userId, user.id),
        eq(careTeamMembers.active, true),
        inArray(careTeamMembers.episodeId, episodeIds),
      ),
    );
  return rows.map((r) => r.episodeId);
}
