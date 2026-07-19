import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const origins = (process.env.API_CORS_ORIGINS ?? 'http://localhost:3000').split(',');
  app.enableCors({ origin: origins, credentials: true });

  const config = new DocumentBuilder()
    .setTitle('HHOS API')
    .setDescription(
      'Home Health + Hospice OS API. Multi-tenant with optional Postgres RLS (FEATURE_RLS). Synthetic data only in non-prod.',
    )
    .setVersion('0.8.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  // No PHI in logs
  console.log(`[hhos/api] listening on :${port} (docs /docs)`);
}

bootstrap();
