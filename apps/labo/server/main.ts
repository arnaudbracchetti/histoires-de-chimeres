// PROTOTYPE (#59). Sert le build Angular et l'API du labo, comme l'image de production.
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { LaboController } from './labo.controller.js';
import { save } from './state.js';

const browserDir = join(import.meta.dirname, '..', '..', 'dist', 'labo', 'browser');

@Module({
  imports: existsSync(browserDir)
    ? [ServeStaticModule.forRoot({ rootPath: browserDir, exclude: ['/api/{*splat}'] })]
    : [],
  controllers: [LaboController],
})
class LaboModule {}

const app = await NestFactory.create(LaboModule);
await app.listen(process.env['PORT'] ?? 3000);

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    save();
    process.exit(0);
  });
}
