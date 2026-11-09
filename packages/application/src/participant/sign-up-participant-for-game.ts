import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { NotificationSender } from '../notification/notification-sender.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/**
 * Un Organisateur inscrit un pseudo à une partie, à sa place (ID-12), aux règles du téléphone
 * (IN-2 à IN-4), et prévient ses autres inscrits si elle passe en très demandée (NO-2). Le pseudo
 * n'est pas notifié (NO-4). Une inscription répétée ne sauvegarde rien.
 */
export class SignUpParticipantForGame {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly notifications: NotificationSender,
  ) {}

  async execute(participantId: string, gameId: string): Promise<void> {
    const catalogue = await this.scenarios.catalogue();
    const notifications = await changeConvention(
      this.conventions,
      (convention) => convention.signUpForGame(participantId, gameId, catalogue),
      (result) => result !== null,
    );
    this.notifications.send(notifications ?? []);
  }
}
