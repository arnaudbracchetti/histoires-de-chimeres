import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConventionModule } from './convention/convention.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

// Le Dockerfile copie les builds Angular dans apps/api/public ; absent en dev,
// où chaque front tourne avec `ng serve` et un proxy vers /api.
const publicDir = join(import.meta.dirname, '..', 'public');

// Back office déclaré en premier : sinon le repli SPA du front office capterait /gestion/*.
const fronts = existsSync(publicDir)
  ? [
      ServeStaticModule.forRoot(
        {
          rootPath: join(publicDir, 'back-office'),
          serveRoot: '/gestion',
          exclude: ['/api/{*splat}'],
        },
        {
          rootPath: join(publicDir, 'front-office'),
          exclude: ['/api/{*splat}', '/gestion/{*splat}'],
        },
      ),
    ]
  : [];

@Module({
  imports: [...fronts, PrismaModule, HealthModule, ConventionModule],
})
export class AppModule {}
