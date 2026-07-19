/**
 * In-process orphan GC for pending_* wound photos and annotations past TTL (PR 7).
 * Also runs large-wound task backfill (K29) on the same tick.
 */
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import {
  organizations,
  photoAnnotations,
  woundPhotos,
  type HhosDb,
} from '@hhos/db';
import { DB } from '../common/db.module';
import { isWoundPhotosEnabled } from '../common/features';
import { ClinicalTasksService } from '../clinical-tasks/clinical-tasks.service';

const DEFAULT_TTL_HOURS = 24;
/** Interval between GC sweeps (ms). */
const GC_INTERVAL_MS = 15 * 60 * 1000;
/** Env override for tests / ops: PHOTO_ORPHAN_GC_INTERVAL_MS */
const GC_INTERVAL_ENV = 'PHOTO_ORPHAN_GC_INTERVAL_MS';
/** Env: PHOTO_ORPHAN_GC_DISABLED=true skips the timer (tests). */
const GC_DISABLED_ENV = 'PHOTO_ORPHAN_GC_DISABLED';

@Injectable()
export class OrphanGcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrphanGcService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly clinicalTasks: ClinicalTasksService,
  ) {}

  onModuleInit(): void {
    if (process.env[GC_DISABLED_ENV] === '1' || process.env[GC_DISABLED_ENV] === 'true') {
      this.logger.log('Orphan GC disabled via PHOTO_ORPHAN_GC_DISABLED');
      return;
    }
    if (!isWoundPhotosEnabled()) {
      this.logger.log('Orphan GC idle — FEATURE_WOUND_PHOTOS off');
      // Still start timer so enabling at runtime is not required for long-lived process;
      // each tick re-checks the flag.
    }

    const raw = process.env[GC_INTERVAL_ENV];
    let interval = GC_INTERVAL_MS;
    if (raw) {
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 5_000) {
        interval = n;
      }
    }

    // Delay first run slightly so boot is not blocked
    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
    // Unref so GC does not keep the process alive in scripts/tests if interval was set
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
    this.logger.log(`Orphan GC scheduled every ${interval}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Test / ops hook: run one GC + backfill cycle. */
  async tick(): Promise<{
    photosAbandoned: number;
    annotationsAbandoned: number;
    tasksBackfilled: number;
  }> {
    if (this.running) {
      return { photosAbandoned: 0, annotationsAbandoned: 0, tasksBackfilled: 0 };
    }
    this.running = true;
    try {
      if (!isWoundPhotosEnabled()) {
        return {
          photosAbandoned: 0,
          annotationsAbandoned: 0,
          tasksBackfilled: 0,
        };
      }
      const photosAbandoned = await this.abandonExpiredPhotos();
      const annotationsAbandoned = await this.abandonExpiredAnnotations();
      let tasksBackfilled = 0;
      try {
        tasksBackfilled = await this.clinicalTasks.backfillLargeWoundTasks(50);
      } catch (err) {
        this.logger.warn(
          `large-wound task backfill failed: ${(err as Error)?.message ?? 'unknown'}`,
        );
      }

      if (photosAbandoned > 0 || annotationsAbandoned > 0 || tasksBackfilled > 0) {
        // Counts only — no per-row PHI; skip audit_events FK (no system org row).
        this.logger.log(
          `orphan GC photos=${photosAbandoned} annotations=${annotationsAbandoned} tasksBackfill=${tasksBackfilled}`,
        );
      }

      return { photosAbandoned, annotationsAbandoned, tasksBackfilled };
    } finally {
      this.running = false;
    }
  }

  private async abandonExpiredPhotos(): Promise<number> {
    const orgs = await this.db
      .select({ id: organizations.id, settings: organizations.settings })
      .from(organizations);

    let total = 0;
    const now = new Date();

    for (const org of orgs) {
      const hours =
        org.settings?.photoPendingTtlHours ?? DEFAULT_TTL_HOURS;
      const cutoff = new Date(now.getTime() - hours * 3600_000);

      const updated = await this.db
        .update(woundPhotos)
        .set({ status: 'abandoned', updatedAt: now })
        .where(
          and(
            eq(woundPhotos.orgId, org.id),
            inArray(woundPhotos.status, ['pending_upload', 'pending_put']),
            lt(woundPhotos.createdAt, cutoff),
            isNull(woundPhotos.deletedAt),
          ),
        )
        .returning({ id: woundPhotos.id });

      total += updated.length;
    }
    return total;
  }

  private async abandonExpiredAnnotations(): Promise<number> {
    // Annotations do not have per-org TTL column on row; use default or join parent org.
    // Use org-level settings via subquery on wound_photos → org.
    const orgs = await this.db
      .select({ id: organizations.id, settings: organizations.settings })
      .from(organizations);

    let total = 0;
    const now = new Date();

    for (const org of orgs) {
      const hours =
        org.settings?.photoPendingTtlHours ?? DEFAULT_TTL_HOURS;
      const cutoff = new Date(now.getTime() - hours * 3600_000);

      // Annotations lack org filter path that's indexed with wound — they have orgId.
      const updated = await this.db
        .update(photoAnnotations)
        .set({ status: 'abandoned' })
        .where(
          and(
            eq(photoAnnotations.orgId, org.id),
            inArray(photoAnnotations.status, [
              'pending_upload',
              'pending_put',
            ]),
            lt(photoAnnotations.createdAt, cutoff),
            isNull(photoAnnotations.deletedAt),
          ),
        )
        .returning({ id: photoAnnotations.id });

      total += updated.length;
    }
    return total;
  }
}
