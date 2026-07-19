import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { createDb, type HhosDb } from '@hhos/db';
import { getRlsDb } from './rls-context';
import { RlsInterceptor } from './rls.interceptor';

export const DB = Symbol('HHOS_DB');

@Global()
@Module({
  providers: [
    {
      provide: 'HHOS_ROOT_DB',
      useFactory: (): HhosDb => createDb(process.env.DATABASE_URL),
    },
    {
      provide: DB,
      inject: ['HHOS_ROOT_DB'],
      useFactory: (root: HhosDb): HhosDb => {
        // Proxy so every inject of DB sees request-scoped RLS transaction when active
        return new Proxy(root, {
          get(target, prop, receiver) {
            const active = getRlsDb(target);
            const value = Reflect.get(active, prop, active);
            if (typeof value === 'function') {
              return value.bind(active);
            }
            return value ?? Reflect.get(target, prop, receiver);
          },
        }) as HhosDb;
      },
    },
    {
      provide: APP_INTERCEPTOR,
      inject: ['HHOS_ROOT_DB'],
      useFactory: (root: HhosDb) => new RlsInterceptor(root),
    },
  ],
  exports: [DB],
})
export class DbModule {}
