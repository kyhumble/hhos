import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { type HhosDb } from '@hhos/db';
import { DB } from '../common/db.module';
import { featureEnabled } from '../common/features';
import { resolveHhosEnv } from '../common/boot-guards';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(@Optional() @Inject(DB) private readonly db?: HhosDb) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'hhos-api',
      phase: '9',
      version: '0.9.0',
      env: resolveHhosEnv(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe — checks DB connectivity and reports feature/config flags (no secrets).
   * Safe for load balancers; never returns PHI.
   */
  @Get('ready')
  async ready() {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};
    let dbOk = false;

    if (this.db) {
      try {
        await this.db.execute(sql`select 1 as ok`);
        dbOk = true;
        checks.database = { ok: true };
      } catch (e) {
        checks.database = {
          ok: false,
          detail: e instanceof Error ? e.message.slice(0, 120) : 'db_error',
        };
      }
    } else {
      checks.database = { ok: false, detail: 'db_not_injected' };
    }

    const flags = {
      rls: featureEnabled('FEATURE_RLS', false),
      oasis: featureEnabled('FEATURE_OASIS', false),
      ordersEsign: featureEnabled('FEATURE_ORDERS_ESIGN', false),
      hospice: featureEnabled('FEATURE_HOSPICE', false),
      billing: featureEnabled('FEATURE_BILLING', false),
      woundPhotos: featureEnabled('FEATURE_WOUND_PHOTOS', false),
      serviceAi: featureEnabled('FEATURE_SERVICE_AI', false),
      authProvider: process.env.AUTH_PROVIDER ?? 'local',
      emailProvider: process.env.EMAIL_PROVIDER ?? 'console',
      hhosEnv: resolveHhosEnv(),
    };

    const ready = dbOk;
    return {
      status: ready ? 'ready' : 'not_ready',
      service: 'hhos-api',
      version: '0.9.0',
      checks,
      flags,
      timestamp: new Date().toISOString(),
    };
  }
}
