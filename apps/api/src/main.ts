import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { API_PREFIX } from '@chimeres/contract';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
