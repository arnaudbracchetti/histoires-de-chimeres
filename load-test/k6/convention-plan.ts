// Le plan des données de départ (docs/load-test/plan.md § 5), en fonctions pures : sans k6 ni
// réseau, elles se vérifient par Node seul.

export const TIME_SLOT_COUNT = 5;
export const TABLE_COUNT = 6;
export const GAME_MASTER_COUNT = 15;
/**
 * 28 scénarios programmés, dont 2 doubles : ils remplissent les 30 cases, 6 parties par créneau.
 * 3 de plus restent en réserve.
 */
export const SCHEDULED_SCENARIO_COUNT = 28;
export const RESERVE_SCENARIO_COUNT = 3;
/** Les rangs, dans la liste des scénarios programmés, des deux scénarios doubles. */
const TWO_SLOT_SCENARIO_INDEXES = new Set([3, 20]);

/** Durée d'un créneau, en minutes. */
const TIME_SLOT_MINUTES = 120;
/** Le créneau mesuré commence une heure après le lancement. */
const MEASURED_TIME_SLOT_DELAY_MINUTES = 60;
/** Dernière fin possible d'un créneau : la journée ne passe pas minuit. */
const LATEST_END_MINUTES = 23 * 60 + 55;

export type PlannedScenario = {
  index: number;
  title: string;
  /** Le rang du MJ, de 0 à 14. */
  gameMasterIndex: number;
  duration: 1 | 2;
};

export type PlannedGame = { scenarioIndex: number; timeSlotIndex: number; tableIndex: number };

/** L'heure de Paris : UTC+2 de mars à octobre (du dernier dimanche, 1 h UTC), UTC+1 sinon. */
export function computeParisOffsetMinutes(now: Date): number {
  const year = now.getUTCFullYear();
  const summerStart = computeLastSundayAtOneUtc(year, 2);
  const summerEnd = computeLastSundayAtOneUtc(year, 9);
  return now >= summerStart && now < summerEnd ? 120 : 60;
}

function computeLastSundayAtOneUtc(year: number, month: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 1));
  return new Date(lastDay.getTime() - lastDay.getUTCDay() * 24 * 60 * 60 * 1000);
}

/**
 * La date de la convention (le jour du lancement, à Paris) et les heures des créneaux : le premier,
 * le créneau mesuré, commence une heure après le lancement, arrondi aux 5 minutes ; les autres le
 * suivent. Les heures reculent si le dernier finit après 23 h 55.
 */
export function computeConventionDay(now: Date): {
  date: string;
  hours: { start: string; end: string }[];
} {
  const paris = new Date(now.getTime() + computeParisOffsetMinutes(now) * 60 * 1000);
  const nowMinutes = paris.getUTCHours() * 60 + paris.getUTCMinutes();
  const span = TIME_SLOT_COUNT * TIME_SLOT_MINUTES;
  const wishedStart = Math.ceil((nowMinutes + MEASURED_TIME_SLOT_DELAY_MINUTES) / 5) * 5;
  const start = Math.min(wishedStart, LATEST_END_MINUTES - span);
  if (start + span <= nowMinutes) {
    throw new Error('Lancement trop tard dans la journée : la convention serait déjà terminée.');
  }
  const hours = Array.from({ length: TIME_SLOT_COUNT }, (_, rank) => ({
    start: formatTime(start + rank * TIME_SLOT_MINUTES),
    end: formatTime(start + (rank + 1) * TIME_SLOT_MINUTES),
  }));
  return { date: paris.toISOString().slice(0, 10), hours };
}

function formatTime(minutes: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * Les 31 scénarios : le scénario `n` revient au MJ `n mod 15`, ce qui donne 2 scénarios à chaque
 * MJ, et 3 au premier. Les 3 derniers restent en réserve.
 */
export function listPlannedScenarios(): PlannedScenario[] {
  return Array.from({ length: SCHEDULED_SCENARIO_COUNT + RESERVE_SCENARIO_COUNT }, (_, index) => ({
    index,
    title: `Scénario ${String(index + 1).padStart(2, '0')}`,
    gameMasterIndex: index % GAME_MASTER_COUNT,
    duration: TWO_SLOT_SCENARIO_INDEXES.has(index) ? 2 : 1,
  }));
}

/**
 * Programme les 28 premiers scénarios, case par case, créneau après créneau : chaque case libre
 * reçoit le premier scénario restant dont le MJ est libre sur ses créneaux, et dont la partie
 * double trouve la même table libre au créneau suivant. Lève si une case reste vide.
 */
export function planGames(scenarios: PlannedScenario[]): PlannedGame[] {
  const remaining = scenarios.slice(0, SCHEDULED_SCENARIO_COUNT);
  const takenCells = new Set<string>();
  const busyGameMasters = new Set<string>();
  const games: PlannedGame[] = [];
  for (let timeSlotIndex = 0; timeSlotIndex < TIME_SLOT_COUNT; timeSlotIndex++) {
    for (let tableIndex = 0; tableIndex < TABLE_COUNT; tableIndex++) {
      if (takenCells.has(`${timeSlotIndex}/${tableIndex}`)) continue;
      const position = remaining.findIndex((scenario) => {
        const slots = Array.from({ length: scenario.duration }, (_, i) => timeSlotIndex + i);
        return slots.every(
          (slot) =>
            slot < TIME_SLOT_COUNT &&
            !takenCells.has(`${slot}/${tableIndex}`) &&
            !busyGameMasters.has(`${slot}/${scenario.gameMasterIndex}`),
        );
      });
      if (position < 0) {
        throw new Error(`Case vide : créneau ${timeSlotIndex + 1}, table ${tableIndex + 1}.`);
      }
      const [scenario] = remaining.splice(position, 1);
      for (let slot = timeSlotIndex; slot < timeSlotIndex + scenario!.duration; slot++) {
        takenCells.add(`${slot}/${tableIndex}`);
        busyGameMasters.add(`${slot}/${scenario!.gameMasterIndex}`);
      }
      games.push({ scenarioIndex: scenario!.index, timeSlotIndex, tableIndex });
    }
  }
  if (remaining.length > 0) {
    throw new Error(`${remaining.length} scénarios sans case.`);
  }
  return games;
}

/** Une présentation d'environ 800 caractères, en Markdown restreint, sans image. */
export function buildPresentation(title: string): string {
  const paragraph =
    'Les joueurs incarnent une troupe de voyageurs pris dans une tempête, au cœur ' +
    "d'une vallée oubliée. Chaque choix compte, et la nuit sera longue.";
  return [
    `**${title}** : une aventure courte, pour découvrir le jeu sans préparation.`,
    paragraph,
    `_${paragraph}_`,
    '- personnages fournis ;\n- règles expliquées à la table ;\n- débutants bienvenus.',
    paragraph,
    paragraph,
  ].join('\n\n');
}
