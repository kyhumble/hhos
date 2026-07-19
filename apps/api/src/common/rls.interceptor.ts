import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { applyRlsConfig, type HhosDb } from '@hhos/db';
import { isRlsEnabled } from './features';
import { rlsAls } from './rls-context';
import type { AuthUser } from './auth.types';

/**
 * When FEATURE_RLS=true, wrap each request in a DB transaction and set
 * transaction-local GUC (app.current_org_id / app.rls_bypass).
 * Request handlers resolve DB via ALS so concurrent pool requests cannot
 * leak tenant context.
 *
 * Requires DATABASE_URL user without SUPERUSER/BYPASSRLS (use hhos_app).
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
  constructor(private readonly rootDb: HhosDb) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!isRlsEnabled()) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    const rlsCtx = user?.orgId
      ? { orgId: user.orgId, bypass: false as const }
      : { bypass: true as const };

    return from(
      this.rootDb.transaction(async (tx) => {
        const txDb = tx as unknown as HhosDb;
        await applyRlsConfig(txDb, rlsCtx);
        return rlsAls.run({ db: txDb }, () => lastValueFrom(next.handle()));
      }),
    );
  }
}
