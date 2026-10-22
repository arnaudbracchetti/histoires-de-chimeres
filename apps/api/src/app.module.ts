import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { API_PREFIX } from '@chimeres/contract';
import { ConventionModule } from './convention/convention.module.js';
import { HealthModule } from './health/health.module.js';
import { ProblemFilter } from './http/problem.filter.js';
import { PrismaModule } from './prisma/prisma.module.js';

// Le Dockerfile copie les builds Angular dans apps/api/public ; absent en dev,
// où chaque front tourne avec `ng serve` et un proxy vers /api.
const publicDir = join(import.meta.dirname, '..', 'public');

const apiRoutes = `/${API_PREFIX}/{*splat}`;

// Back office déclaré en premier : sinon le repli SPA du front office capterait /gestion/*.
const fronts = existsSync(publicDir)
  ? [
      ServeStaticModule.forRoot(
        {
          rootPath: join(publicDir, 'back-office'),
          serveRoot: '/gestion',
          exclude: [apiRoutes],
        },
        {
          rootPath: join(publicDir, 'front-office'),
          exclude: [apiRoutes, '/gestion/{*splat}'],
        },
      ),
    ]
  : [];

@Module({
  imports: [...fronts, PrismaModule, HealthModule, ConventionModule],
  // Filtre global, déclaré ici pour valoir aussi dans les tests qui démarrent AppModule.
  providers: [{ provide: APP_FILTER, useClass: ProblemFilter }],
})
export class AppModule {}
