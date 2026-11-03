import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createSeededRandom } from '@chimeres/draw';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { RANDOM_SOURCE } from '../src/draw/random-source.token.js';

/**
 * Démarre l'application complète, configurée comme main.ts, sur la base de test. Le hasard du
 * tirage y a une graine fixe. `override` remplace d'autres providers (un faux algorithme de tirage).
 */
export async function startApp(
  override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<NestExpressApplication> {
  const moduleRef = await override(
    Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RANDOM_SOURCE)
      .useValue(createSeededRandom(1)),
  ).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}
