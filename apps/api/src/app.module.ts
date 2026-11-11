import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { API_PREFIX } from '@chimeres/contract';
import { AccountModule } from './account/account.module.js';
import { ConventionModule } from './convention/convention.module.js';
import { DrawModule } from './draw/draw.module.js';
import { FrontOfficeModule } from './front-office/front-office.module.js';
import { GameModule } from './game/game.module.js';
import { GameMasterModule } from './game-master/game-master.module.js';
import { HealthModule } from './health/health.module.js';
import { ParticipantModule } from './participant/participant.module.js';
import { ScenarioModule } from './scenario/scenario.module.js';
import { SignUpTrackingModule } from './sign-up-tracking/sign-up-tracking.module.js';
import { TableModule } from './table/table.module.js';
import { TimeSlotModule } from './time-slot/time-slot.module.js';
import { CrossSiteWriteGuard } from './http/cross-site-write.guard.js';
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
  imports: [
    ...fronts,
    PrismaModule,
    HealthModule,
    AccountModule,
    ConventionModule,
    TimeSlotModule,
    TableModule,
    GameMasterModule,
    ParticipantModule,
    ScenarioModule,
    GameModule,
    SignUpTrackingModule,
    DrawModule,
    FrontOfficeModule,
  ],
  // Filtre et garde globaux, déclarés ici pour valoir aussi dans les tests qui démarrent AppModule.
  providers: [
    { provide: APP_FILTER, useClass: ProblemFilter },
    { provide: APP_GUARD, useClass: CrossSiteWriteGuard },
  ],
})
export class AppModule {}
