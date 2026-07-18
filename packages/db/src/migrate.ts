import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';

async function main() {
  const url = process.env.DATABASE_URL ?? 'postgresql://hhos:hhos_dev@localhost:5432/hhos';
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  const migrationsFolder = path.join(__dirname, 'migrations');
  console.log('[hhos/db] Migrating from', migrationsFolder);

  await migrate(db, { migrationsFolder });
  console.log('[hhos/db] Migrations complete');
  await client.end();
}

main().catch((err) => {
  console.error('[hhos/db] Migration failed', err instanceof Error ? err.message : 'unknown');
  process.exit(1);
});
