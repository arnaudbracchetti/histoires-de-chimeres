import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { API_PREFIX } from '@chimeres/contract';
import { AppModule } from '../src/app.module.js';

/** Démarre l'application complète, configurée comme main.ts, sur la base de test. */
export async function startApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix(API_PREFIX);
  await app.init();
  return app;
}
