import { Global, Module } from '@nestjs/common';
import { createDb, type HhosDb } from '@hhos/db';

export const DB = Symbol('HHOS_DB');

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): HhosDb => createDb(process.env.DATABASE_URL),
    },
  ],
  exports: [DB],
})
export class DbModule {}
