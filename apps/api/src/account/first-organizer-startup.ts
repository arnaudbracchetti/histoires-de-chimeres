import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InitializeFirstOrganizer, type FirstOrganizer } from '@chimeres/application';
import { Refusal } from '@chimeres/domain';
import { buildRefusalMessage } from '../http/problem-catalogue.js';
import { FIRST_ORGANIZER_SETTINGS } from './first-organizer-settings.token.js';

/**
 * Applique le premier Organisateur de la configuration au démarrage, avant toute requête
 * (ADR 0016). Une valeur refusée arrête le démarrage : le healthcheck échoue, et le déploiement
 * revient à la version précédente.
 */
@Injectable()
export class FirstOrganizerStartup implements OnApplicationBootstrap {
  private readonly logger = new Logger(FirstOrganizerStartup.name);

  constructor(
    @Inject(FIRST_ORGANIZER_SETTINGS) private readonly settings: FirstOrganizer | null,
    @Inject(InitializeFirstOrganizer) private readonly initialize: InitializeFirstOrganizer,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.settings) return;
    try {
      await this.initialize.execute(this.settings);
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      const { title, detail } = buildRefusalMessage(error.code, error.params);
      throw new Error(`ORGANIZER_PSEUDO / ORGANIZER_PASSWORD refusés : ${title}. ${detail}`, {
        cause: error,
      });
    }
    this.logger.log('Premier Organisateur vérifié.');
  }
}
