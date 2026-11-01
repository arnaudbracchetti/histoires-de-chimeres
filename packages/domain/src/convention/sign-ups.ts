import { Refusal } from '../refusal.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { Scenario } from '../scenario/scenario.js';
import type { Seats } from '../scenario/seats.js';
import type { Day } from './day.js';
import type { Game } from './game.js';
import type { Schedule } from './schedule.js';
import type { SignUp } from './sign-up.js';
import type { Table } from './table.js';
import type { UniquelyNamedCollection } from './uniquely-named-collection.js';

/** Les parties que mène chaque participant, par son rôle de MJ (ADR 0012). */
export type LedGames = {
  listGamesLedByParticipant(participantId: string): readonly Game[];
};

/**
 * Les chiffres des inscriptions d'une partie : ses inscriptions actives (`signUpCount`, IN-4), et
 * combien de ses inscrits n'ont pas d'autre inscription active sur son premier créneau
 * (`withoutOtherSignUpCount`).
 */
export type SignUpFigures = { signUpCount: number; withoutOtherSignUpCount: number };

/** Les inscriptions qu'un geste retire à une partie (IN-6) : les chiffres de ses inscriptions. */
export type RemovedSignUps = { gameId: string } & SignUpFigures;

/**
 * Ce que les règles des inscriptions lisent hors d'elles : le Programme, et qui y mène quoi. La
 * convention les fournit ensemble, tirés du même état.
 */
export type SignUpCollaborators = { schedule: Schedule; ledGames: LedGames };

/**
 * Inscriptions : celles de la convention, dans l'ordre où elles ont été prises. Elles gardent les
 * règles IN-2 à IN-6. Immuables : chaque geste rend d'autres inscriptions. Le Programme et qui y
 * mène quoi leur sont passés à chaque appel : c'est la convention qui les détient.
 */
export class SignUps {
  private constructor(readonly signUps: readonly SignUp[]) {}

  /** `signUps`, dans l'ordre où elles ont été prises. */
  static createFromSignUps(signUps: Iterable<SignUp>): SignUps {
    return new SignUps([...signUps]);
  }

  /**
   * L'inscription est active, sauf si son participant mène une partie sur l'un des créneaux de la
   * partie (IN-4) : elle n'entre alors ni dans le nombre d'inscrits, ni dans « très demandée », ni
   * dans le tirage. Elle reste en place, et redevient active quand il n'y mène plus. Statique pour
   * que la lecture compte les inscrits sans charger l'agrégat.
   */
  static isSignUpActive(
    gameTimeSlotIds: readonly string[],
    timeSlotIdsLedByParticipant: readonly string[],
  ): boolean {
    return !gameTimeSlotIds.some((slotId) => timeSlotIdsLedByParticipant.includes(slotId));
  }

  hasSignUp(signUp: SignUp): boolean {
    return this.signUps.some((existing) => existing.equals(signUp));
  }

  /**
   * Les inscriptions après celle-ci (IN-2). S'inscrire de nouveau ne change rien. Un MJ ne s'inscrit
   * pas sur un créneau où il mène, sa propre partie comprise (IN-4) : le refus donne le créneau et la
   * table de sa partie.
   */
  getSignUpsAfterSigningUp(
    signUp: SignUp,
    { schedule, ledGames }: SignUpCollaborators,
    day: Day,
    tables: UniquelyNamedCollection<Table>,
  ): SignUps {
    const led = ledGames.listGamesLedByParticipant(signUp.participantId);
    for (const slotId of schedule.findExistingGameById(signUp.gameId).timeSlotIds) {
      const run = led.find((game) => game.isOnTimeSlot(slotId));
      if (!run) continue;
      throw new Refusal('leads-game-on-time-slot', {
        rank: day.getTimeSlotRank(slotId),
        table: tables.findExistingItemById(run.tableId).name.text,
      });
    }
    if (this.hasSignUp(signUp)) return this;
    return new SignUps([...this.signUps, signUp]);
  }

  /** Les inscriptions sans celle-ci (IN-2). Retirer une absente ne change rien. */
  getSignUpsAfterWithdrawing(signUp: SignUp): SignUps {
    return new SignUps(this.signUps.filter((existing) => !existing.equals(signUp)));
  }

  /** Les inscriptions sans celles du participant, qui disparaît (PR-12). */
  getSignUpsAfterRemovingParticipant(participantId: string): SignUps {
    return new SignUps(this.signUps.filter((signUp) => signUp.participantId !== participantId));
  }

  /**
   * Les inscriptions après le passage du Programme `previous` à `next`. Une partie déprogrammée, ou
   * qui passe sur d'autres créneaux, perd ses inscriptions ; changer de table les garde (IN-6).
   */
  getSignUpsAfterChangingSchedule(previous: Schedule, next: Schedule): SignUps {
    return new SignUps(
      this.signUps.filter(({ gameId }) =>
        SignUps.isGameKeepingSignUps(previous.findExistingGameById(gameId), next),
      ),
    );
  }

  /**
   * Les inscriptions actives que le passage au Programme `next` retirerait, selon la règle de
   * `getSignUpsAfterChangingSchedule()` (IN-6) : une entrée par partie qui en perd, dans l'ordre du
   * Programme d'avant. `collaborators` : ceux du Programme d'avant. Une partie sans inscrit actif
   * n'en a pas.
   */
  computeRemovedSignUpsAfterChangingSchedule(
    next: Schedule,
    collaborators: SignUpCollaborators,
  ): RemovedSignUps[] {
    return collaborators.schedule.games
      .filter((game) => !SignUps.isGameKeepingSignUps(game, next))
      .flatMap((game): RemovedSignUps[] => {
        const figures = this.computeSignUpFiguresOfGame(game, collaborators);
        return figures.signUpCount ? [{ gameId: game.id, ...figures }] : [];
      });
  }

  /** Les chiffres des inscriptions de la partie : voir `SignUpFigures`. */
  computeSignUpFiguresOfGame(game: Game, collaborators: SignUpCollaborators): SignUpFigures {
    return {
      signUpCount: this.listActiveParticipantIdsOfGame(game, collaborators).length,
      withoutOtherSignUpCount: this.listParticipantIdsWithOnlyActiveSignUpOnFirstTimeSlot(
        game,
        collaborators,
      ).length,
    };
  }

  /** Les participants dont l'inscription à la partie est active (IN-4), dans l'ordre de leur inscription. */
  listActiveParticipantIdsOfGame(game: Game, collaborators: SignUpCollaborators): string[] {
    return this.signUps
      .filter((signUp) => signUp.gameId === game.id && this.isActive(signUp, collaborators))
      .map(({ participantId }) => participantId);
  }

  /** Les parties où l'inscription du participant est active (IN-4), dans l'ordre de son inscription. */
  listActiveGameIdsOfParticipant(
    participantId: string,
    collaborators: SignUpCollaborators,
  ): string[] {
    return this.signUps
      .filter(
        (signUp) => signUp.participantId === participantId && this.isActive(signUp, collaborators),
      )
      .map(({ gameId }) => gameId);
  }

  /**
   * La demande du créneau : le nombre de participants distincts qui ont au moins une inscription
   * active sur une partie qui y commence. Une partie double ne compte que sur son premier créneau.
   */
  countDemandOnTimeSlot(timeSlotId: string, collaborators: SignUpCollaborators): number {
    return new Set(
      collaborators.schedule
        .listGamesStartingOnTimeSlot(timeSlotId)
        .flatMap((game) => this.listActiveParticipantIdsOfGame(game, collaborators)),
    ).size;
  }

  /**
   * Les destinataires de « partie très demandée » si cette inscription, la dernière prise, fait
   * passer sa partie au-dessus de ses places maximum, que le catalogue, entier, donne ; sinon aucun.
   * L'auteur de l'inscription n'en est pas : il vient de voir la confirmation (IN-5).
   */
  listOversubscriptionRecipientsAfterSigningUp(
    signUp: SignUp,
    catalogue: ScenarioCatalogue,
    collaborators: SignUpCollaborators,
  ): string[] {
    const game = collaborators.schedule.findExistingGameById(signUp.gameId);
    const { maxSeats } = catalogue.findExistingEntryById(game.scenarioId);
    const signedUp = this.listActiveParticipantIdsOfGame(game, collaborators);
    if (signedUp.length !== maxSeats + 1) return [];
    return this.listParticipantIdsWithOnlyActiveSignUpOnFirstTimeSlot(game, collaborators).filter(
      (participantId) => participantId !== signUp.participantId,
    );
  }

  /**
   * Les destinataires de « partie très demandée » si la baisse des places maximum du scénario, depuis
   * `previousSeats`, fait passer la partie au-dessus ; sinon aucun (IN-5, PR-4).
   */
  listOversubscriptionRecipientsAfterSeatsChange(
    game: Game,
    scenario: Scenario,
    previousSeats: Seats,
    collaborators: SignUpCollaborators,
  ): string[] {
    const count = this.listActiveParticipantIdsOfGame(game, collaborators).length;
    if (count <= scenario.seats.max || count > previousSeats.max) return [];
    return this.listParticipantIdsWithOnlyActiveSignUpOnFirstTimeSlot(game, collaborators);
  }

  /**
   * Les inscrits actifs de la partie dont c'est la seule inscription active sur son premier créneau,
   * dans l'ordre de leur inscription (IN-5). Une partie double ne compte que sur son premier créneau.
   */
  private listParticipantIdsWithOnlyActiveSignUpOnFirstTimeSlot(
    game: Game,
    collaborators: SignUpCollaborators,
  ): string[] {
    const firstTimeSlotId = game.timeSlotIds[0]!;
    const signedUpElsewhere = new Set(
      this.signUps
        .filter(
          (signUp) =>
            signUp.gameId !== game.id &&
            collaborators.schedule.findExistingGameById(signUp.gameId).timeSlotIds[0] ===
              firstTimeSlotId &&
            this.isActive(signUp, collaborators),
        )
        .map(({ participantId }) => participantId),
    );
    return this.listActiveParticipantIdsOfGame(game, collaborators).filter(
      (participantId) => !signedUpElsewhere.has(participantId),
    );
  }

  /** La partie garde ses inscriptions dans le Programme `next` : elle y est, sur les mêmes créneaux (IN-6). */
  private static isGameKeepingSignUps(game: Game, next: Schedule): boolean {
    return next.hasGameOnSameTimeSlots(game);
  }

  /** L'inscription est active : voir `SignUps.isSignUpActive()`. */
  private isActive(signUp: SignUp, { schedule, ledGames }: SignUpCollaborators): boolean {
    return SignUps.isSignUpActive(
      schedule.findExistingGameById(signUp.gameId).timeSlotIds,
      ledGames.listGamesLedByParticipant(signUp.participantId).flatMap((game) => game.timeSlotIds),
    );
  }
}
