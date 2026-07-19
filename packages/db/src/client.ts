import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export type HhosDb = ReturnType<typeof createDb>;
export type PostgresSql = ReturnType<typeof postgres>;

let sharedSql: PostgresSql | null = null;

export function createDb(connectionString?: string) {
  const url =
    connectionString ??
    process.env.DATABASE_URL ??
    'postgresql://hhos:hhos_dev@localhost:5432/hhos';

  const client = postgres(url, {
    max: 10,
    // Avoid logging connection strings that may appear in errors with credentials
  });
  sharedSql = client;

  return drizzle(client, { schema });
}

/** Underlying postgres.js client (for request-scoped transactions / reserve). */
export function getPostgresSql(): PostgresSql {
  if (!sharedSql) {
    createDb();
  }
  return sharedSql!;
}

export { schema };
