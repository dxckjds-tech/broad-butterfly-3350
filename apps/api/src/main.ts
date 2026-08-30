import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  const isProd = process.env.NODE_ENV === 'production';
  const whitelist = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!origin) {
    callback(null, true);
    return;
  }
  if (!isProd) {
    if (
      origin.startsWith('chrome-extension://') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')
    ) {
      callback(null, true);
      return;
    }
  }
  if (whitelist.length === 0 || whitelist.includes(origin) || origin.startsWith('chrome-extension://')) {
    callback(null, true);
    return;
  }
  callback(new Error(`CORS blocked for origin ${origin}`), false);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: false });
  app.setGlobalPrefix(process.env.API_PREFIX || 'api');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`trade-ai-store-doctor-api listening on http://localhost:${port}/api`);
}

void bootstrap();
