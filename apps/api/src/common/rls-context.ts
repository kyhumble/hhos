import { AsyncLocalStorage } from 'node:async_hooks';
import type { HhosDb } from '@hhos/db';

type Store = { db: HhosDb };

/** Per-request Drizzle handle bound to an RLS transaction (FEATURE_RLS). */
export const rlsAls = new AsyncLocalStorage<Store>();

export function getRlsDb(fallback: HhosDb): HhosDb {
  return rlsAls.getStore()?.db ?? fallback;
}
