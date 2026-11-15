// La préparation des données de départ, dans `setup()`, par l'API (docs/load-test/plan.md § 5).
import { sendAndReadResponse, sendAndVerifySuccess } from './api.ts';
import {
  GAME_MASTER_COUNT,
  TABLE_COUNT,
  buildPresentation,
  computeConventionDay,
  listPlannedScenarios,
  planGames,
} from './convention-plan.ts';
import {
  account,
  availability,
  convention,
  participant,
  scenario,
  schedule,
  table,
  timeSlot,
} from './endpoints.ts';

const PREPARATION = 'preparation';

/** Ce que la préparation passe aux phases du test. */
export type PreparedConvention = {
  presenceCode: string;
  /** Les pseudos des MJ, que 10 % des téléphones saisissent. */
  gameMasterNicknames: string[];
};

/**
 * Connecte l'Organisateur de test2, puis crée la convention du test sur une base remise à zéro : 5
 * créneaux, 6 tables, 15 MJ disponibles partout, 31 scénarios, dont 28 programmés et 3 en réserve.
 */
export function prepareConvention(): PreparedConvention {
  logInOrganizer();
  const current = sendAndReadResponse(convention.read, { phase: PREPARATION });
  if (current.timeSlots.length > 0 || current.tables.length > 0) {
    throw new Error('La convention a déjà des créneaux ou des tables : remettre la base à zéro.');
  }

  const day = computeConventionDay(new Date());
  sendAndVerifySuccess(convention.update, {
    phase: PREPARATION,
    body: { name: current.name, date: day.date },
  });
  let timeSlotIds: string[] = [];
  for (const hours of day.hours) {
    const updated = sendAndReadResponse(timeSlot.add, { phase: PREPARATION, body: hours });
    timeSlotIds = updated.timeSlots.map(({ id }) => id);
  }
  let tableIds: string[] = [];
  for (let rank = 1; rank <= TABLE_COUNT; rank++) {
    const updated = sendAndReadResponse(table.add, {
      phase: PREPARATION,
      body: { name: `Table ${rank}` },
    });
    tableIds = updated.tables.map(({ id }) => id);
  }

  const gameMasters = addGameMasters(timeSlotIds);
  const scenarios = listPlannedScenarios();
  const scenarioIds = scenarios.map((planned) => {
    const gameMasterId = gameMasters[planned.gameMasterIndex]!.id;
    const proposed = sendAndReadResponse(
      scenario.propose,
      {
        phase: PREPARATION,
        body: {
          title: planned.title,
          system: 'Système maison',
          presentation: buildPresentation(planned.title),
          contentWarnings: '',
          seats: { min: 3, max: 5 },
          duration: planned.duration,
        },
      },
      { gameMasterId },
    );
    return proposed.id;
  });

  for (const game of planGames(scenarios)) {
    sendAndVerifySuccess(schedule.schedule, {
      phase: PREPARATION,
      body: {
        scenarioId: scenarioIds[game.scenarioIndex]!,
        timeSlotId: timeSlotIds[game.timeSlotIndex]!,
        tableId: tableIds[game.tableIndex]!,
      },
    });
  }

  return {
    presenceCode: current.presenceCode,
    gameMasterNicknames: gameMasters.map(({ nickname }) => nickname),
  };
}

/** Les identifiants de l'Organisateur de test2, lus sur le poste, jamais dans le dépôt. */
function logInOrganizer(): void {
  const nickname = __ENV.ORGANIZER_PSEUDO;
  const password = __ENV.ORGANIZER_PASSWORD;
  if (!nickname || !password) {
    throw new Error('ORGANIZER_PSEUDO et ORGANIZER_PASSWORD manquent : voir load-test/README.md.');
  }
  sendAndVerifySuccess(account.logIn, { phase: PREPARATION, body: { nickname, password } });
}

/** Crée les 15 MJ, disponibles sur tous les créneaux. */
function addGameMasters(timeSlotIds: string[]): { id: string; nickname: string }[] {
  return Array.from({ length: GAME_MASTER_COUNT }, (_, index) => {
    const nickname = `MJ ${String(index + 1).padStart(2, '0')}`;
    const added = sendAndReadResponse(participant.add, {
      phase: PREPARATION,
      body: { nickname, roles: ['game-master'] },
    });
    const gameMasterId = added.gameMasterId!;
    for (const timeSlotId of timeSlotIds) {
      sendAndVerifySuccess(
        availability.declare,
        { phase: PREPARATION },
        { gameMasterId, timeSlotId },
      );
    }
    return { id: gameMasterId, nickname };
  });
}
