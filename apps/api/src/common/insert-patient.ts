import { sql } from 'drizzle-orm';
import { patients, type HhosDb } from '@hhos/db';
import { generateMrn } from './mrn';
import { isUniqueViolation } from './db-errors';

type PatientInsert = typeof patients.$inferInsert;

type TxLike = Pick<HhosDb, 'insert' | 'execute'>;

/**
 * Insert a patient row, regenerating MRN on unique collision.
 * Must run inside an open transaction (uses SAVEPOINT so PG does not abort the TX).
 */
export async function insertPatientWithMrnRetry(
  executor: TxLike,
  values: Omit<PatientInsert, 'mrn'> & { mrn?: string },
  maxAttempts = 5,
): Promise<typeof patients.$inferSelect> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Controlled identifier — not user input
    const sp = `sp_mrn_${attempt}`;
    await executor.execute(sql.raw(`SAVEPOINT ${sp}`));
    try {
      const [row] = await executor
        .insert(patients)
        .values({
          ...values,
          mrn: values.mrn ?? generateMrn(),
        })
        .returning();
      if (!row) throw new Error('Patient insert returned no row');
      await executor.execute(sql.raw(`RELEASE SAVEPOINT ${sp}`));
      return row;
    } catch (err) {
      await executor.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${sp}`));
      if (isUniqueViolation(err) && attempt < maxAttempts - 1) {
        // Drop forced mrn so next attempt regenerates
        values = { ...values, mrn: undefined };
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to allocate unique MRN');
}
