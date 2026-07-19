import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { assertBootGuards } from './common/boot-guards';
import { HhosNestLogger, log } from './common/logger';

async function bootstrap() {
  assertBootGuards();

  const app = await NestFactory.create(AppModule, {
    logger: new HhosNestLogger(),
  });

  const origins = (process.env.API_CORS_ORIGINS ?? 'http://localhost:3000').split(',');
  app.enableCors({ origin: origins, credentials: true });

  const config = new DocumentBuilder()
    .setTitle('HHOS API')
    .setDescription(
      'Home Health + Hospice OS API. Multi-tenant SaaS (Phase 9 platform). Optional Postgres RLS (FEATURE_RLS). Synthetic data only in non-prod.',
    )
    .setVersion('0.9.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  log.info('api_listening', { port, docs: '/docs', ready: '/ready' });
}

bootstrap().catch((err) => {
  log.error('api_boot_failed', {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
