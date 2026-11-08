import { Refusal } from '../refusal.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { Scenario } from '../scenario/scenario.js';
import type { Seats } from '../scenario/seats.js';
import type { Game } from './game.js';
import { ParticipantWithoutGame } from './participant-without-game.js';
import type { Schedule } from './schedule.js';
import type { SignUp } from './sign-up.js';

/** Les parties que mène chaque participant, par son rôle de MJ (ADR 0012). */
export type LedGames = {
  listGamesLedByParticipant(participantId: string): readonly Game[];
};

/**
 * Les créneaux que chaque participant occupe comme joueur d'une partie double, placé par un tirage
 * publié : ceux qui suivent le premier créneau de la partie (TI-3).
 */
export type PlayedTimeSlots = {
  listTimeSlotIdsPlayedByParticipant(participantId: string): readonly string[];
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
 * Ce que les règles des inscriptions lisent hors d'elles : le Programme, qui y mène quoi, et qui
 * joue une partie double publiée. La convention les fournit ensemble, tirés du même état.
 */
export type SignUpCollaborators = {
  schedule: Schedule;
  ledGames: LedGames;
  playedTimeSlots: PlayedTimeSlots;
};

/**
 * Inscriptions : celles de la convention, dans l'ordre où elles ont été prises, et les participants
 * sans partie. Elles gardent les règles IN-2 à IN-6. Immuables : chaque geste rend d'autres
 * inscriptions. Le Programme et qui y mène quoi leur sont passés à chaque appel : c'est la
 * convention qui les détient.
 */
export class SignUps {
  private constructor(
    readonly signUps: readonly SignUp[],
    readonly participantsWithoutGame: readonly ParticipantWithoutGame[],
  ) {}

  /** `signUps`, dans l'ordre où elles ont été prises, et les participants sans partie. */
  static createFromSignUps(
    signUps: Iterable<SignUp>,
    participantsWithoutGame: Iterable<ParticipantWithoutGame>,
  ): SignUps {
    return new SignUps([...signUps], [...participantsWithoutGame]);
  }

  /**
   * L'inscription est active, sauf si son participant mène une partie sur l'un des créneaux de la
   * partie (IN-4), ou s'il joue, sur le premier créneau de la partie, une partie double commencée
   * au créneau d'avant, où un tirage publié l'a placé (TI-3). Elle n'entre alors ni dans le nombre
   * d'inscrits, ni dans « très demandée », ni dans le tirage. Elle reste en place, et redevient
   * active quand il n'y mène plus. Statique pour que la lecture compte les inscrits sans charger
   * l'agrégat.
   */
  static isSignUpActive(
    gameTimeSlotIds: readonly string[],
    timeSlotIdsLedByParticipant: readonly string[],
    timeSlotIdsPlayedByParticipant: readonly string[],
  ): boolean {
    return (
      !gameTimeSlotIds.some((slotId) => timeSlotIdsLedByParticipant.includes(slotId)) &&
      !timeSlotIdsPlayedByParticipant.includes(gameTimeSlotIds[0]!)
    );
  }

  hasSignUp(signUp: SignUp): boolean {
    return this.signUps.some((existing) => existing.equals(signUp));
  }

  /**
   * Le participant est sans partie sur le créneau : son état est enregistré, son MJ n'y mène pas
   * (IN-4), et il n'y joue pas une partie double où un tirage publié l'a placé (TI-3). Sinon,
   * l'état reste, ignoré.
   */
  isParticipantWithoutGameOnTimeSlot(
    participantId: string,
    timeSlotId: string,
    collaborators: SignUpCollaborators,
  ): boolean {
    return (
      this.hasParticipantWithoutGame(new ParticipantWithoutGame(participantId, timeSlotId)) &&
      !isTakenOnTimeSlot(participantId, timeSlotId, collaborators)
    );
  }

  /** L'état sans partie est enregistré, même ignoré tant que son MJ mène sur le créneau (IN-4). */
  hasParticipantWithoutGame(candidate: ParticipantWithoutGame): boolean {
    return this.participantsWithoutGame.some((recorded) => recorded.equals(candidate));
  }

  /** Les participants sans partie sur le créneau (voir `isParticipantWithoutGameOnTimeSlot()`). */
  listParticipantIdsWithoutGameOnTimeSlot(
    timeSlotId: string,
    collaborators: SignUpCollaborators,
  ): string[] {
    return this.participantsWithoutGame
      .filter(
        (recorded) =>
          recorded.timeSlotId === timeSlotId &&
          !isTakenOnTimeSlot(recorded.participantId, timeSlotId, collaborators),
      )
      .map(({ participantId }) => participantId);
  }

  /**
   * Les inscriptions après celle-ci (IN-2). S'inscrire de nouveau ne change rien. Un MJ ne s'inscrit
   * pas à sa propre partie ; sur une autre partie d'un créneau où il mène, son inscription est de
   * secours : elle reste inactive tant qu'il y mène (IN-4). S'inscrire à une partie du créneau,
   * celui où elle commence, fait cesser d'être sans partie sur ce créneau.
   */
  getSignUpsAfterSigningUp(signUp: SignUp, { schedule, ledGames }: SignUpCollaborators): SignUps {
    const led = ledGames.listGamesLedByParticipant(signUp.participantId);
    if (led.some((game) => game.id === signUp.gameId)) {
      throw new Refusal('game-led-by-participant', {});
    }
    if (this.hasSignUp(signUp)) return this;
    const firstTimeSlotId = schedule.findExistingGameById(signUp.gameId).timeSlotIds[0]!;
    return new SignUps(
      [...this.signUps, signUp],
      this.participantsWithoutGame.filter(
        (recorded) =>
          !recorded.equals(new ParticipantWithoutGame(signUp.participantId, firstTimeSlotId)),
      ),
    );
  }

  /** Les inscriptions sans celle-ci (IN-2). Retirer une absente ne change rien. */
  getSignUpsAfterWithdrawing(signUp: SignUp): SignUps {
    return new SignUps(
      this.signUps.filter((existing) => !existing.equals(signUp)),
      this.participantsWithoutGame,
    );
  }

  /**
   * Les inscriptions après que le participant s'est retiré du tirage du créneau : il n'y est plus
   * sans partie. Sans cet état, rien ne change.
   */
  getSignUpsAfterWithdrawingFromDraw(withdrawn: ParticipantWithoutGame): SignUps {
    return new SignUps(
      this.signUps,
      this.participantsWithoutGame.filter((recorded) => !recorded.equals(withdrawn)),
    );
  }

  /** Les inscriptions sans celles du participant, qui disparaît, ni son état sans partie (PR-12). */
  getSignUpsAfterRemovingParticipant(participantId: string): SignUps {
    return new SignUps(
      this.signUps.filter((signUp) => signUp.participantId !== participantId),
      this.participantsWithoutGame.filter((recorded) => recorded.participantId !== participantId),
    );
  }

  /**
   * Les inscriptions sans celles de ces parties, annulées puis déprogrammées par la publication
   * (TI-7) : aucun de leurs inscrits ne devient sans partie.
   */
  getSignUpsAfterUnschedulingGames(gameIds: readonly string[]): SignUps {
    return new SignUps(
      this.signUps.filter((signUp) => !gameIds.includes(signUp.gameId)),
      this.participantsWithoutGame,
    );
  }

  /** Les inscriptions sans les participants sans partie du créneau, qui disparaît (PR-10). */
  getSignUpsAfterRemovingTimeSlot(timeSlotId: string): SignUps {
    return new SignUps(
      this.signUps,
      this.participantsWithoutGame.filter((recorded) => recorded.timeSlotId !== timeSlotId),
    );
  }

  /**
   * Les inscriptions après le passage du Programme d'avant (`previous`) à celui d'après (`next`),
   * chacun avec qui y mène quoi. Une partie déprogrammée, ou qui passe sur d'autres créneaux, perd
   * ses inscriptions ; changer de table les garde (IN-6). Un inscrit actif qui y perd sa dernière
   * inscription active sur le premier créneau de la partie devient sans partie sur ce créneau, sauf
   * si son MJ y mène (IN-4).
   */
  getSignUpsAfterChangingSchedule(
    previous: SignUpCollaborators,
    next: SignUpCollaborators,
  ): SignUps {
    const isKept = ({ gameId }: SignUp) =>
      SignUps.isGameKeepingSignUps(previous.schedule.findExistingGameById(gameId), next.schedule);
    const remaining = new SignUps(this.signUps.filter(isKept), this.participantsWithoutGame);
    const becomingWithoutGame = this.signUps
      .filter((signUp) => !isKept(signUp) && this.isActive(signUp, previous))
      .map(
        ({ participantId, gameId }) =>
          new ParticipantWithoutGame(
            participantId,
            previous.schedule.findExistingGameById(gameId).timeSlotIds[0]!,
          ),
      )
      .filter(
        ({ participantId, timeSlotId }) =>
          !remaining.hasActiveSignUpOnTimeSlot(participantId, timeSlotId, next) &&
          !isLeadingOnTimeSlot(participantId, timeSlotId, next.ledGames),
      );
    let result = remaining;
    for (const candidate of becomingWithoutGame) {
      if (!result.hasParticipantWithoutGame(candidate)) {
        result = new SignUps(result.signUps, [...result.participantsWithoutGame, candidate]);
      }
    }
    return result;
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

  /**
   * Les participants à prévenir d'un changement de la partie, dans l'ordre de leur inscription :
   * ses inscrits actifs, et les MJ qui s'y sont inscrits en secours (IN-4).
   */
  listActiveOrBackupParticipantIdsOfGame(game: Game, collaborators: SignUpCollaborators): string[] {
    return this.signUps
      .filter(
        (signUp) =>
          signUp.gameId === game.id &&
          (this.isActive(signUp, collaborators) || this.isBackup(signUp, collaborators)),
      )
      .map(({ participantId }) => participantId);
  }

  /**
   * Les inscriptions de secours du participant, dans l'ordre où elles ont été prises : sur un
   * créneau où il mène une partie que donne `ledGames`, sauf à cette partie (IN-4).
   */
  listBackupGameIdsOfParticipant(
    participantId: string,
    collaborators: Pick<SignUpCollaborators, 'schedule' | 'ledGames'>,
  ): string[] {
    return this.signUps
      .filter(
        (signUp) => signUp.participantId === participantId && this.isBackup(signUp, collaborators),
      )
      .map(({ gameId }) => gameId);
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
   * Le nombre d'inscriptions du participant aux parties qui commencent sur le créneau, de secours
   * comprises (IN-4). Une partie double ne compte que sur son premier créneau.
   */
  countSignUpsOfParticipantOnTimeSlot(
    participantId: string,
    timeSlotId: string,
    schedule: Schedule,
  ): number {
    return this.signUps.filter(
      (signUp) =>
        signUp.participantId === participantId &&
        schedule.findGameById(signUp.gameId)?.timeSlotIds[0] === timeSlotId,
    ).length;
  }

  /**
   * La demande du créneau : le nombre de participants distincts qui ont au moins une inscription
   * active sur une partie qui y commence, ou qui y sont sans partie. Une partie double ne compte que
   * sur son premier créneau.
   */
  countDemandOnTimeSlot(timeSlotId: string, collaborators: SignUpCollaborators): number {
    return new Set([
      ...collaborators.schedule
        .listGamesStartingOnTimeSlot(timeSlotId)
        .flatMap((game) => this.listActiveParticipantIdsOfGame(game, collaborators)),
      ...this.listParticipantIdsWithoutGameOnTimeSlot(timeSlotId, collaborators),
    ]).size;
  }

  /**
   * Les destinataires de « partie très demandée » si cette inscription, la dernière prise, fait
   * passer sa partie au-dessus de ses places maximum, que le catalogue, entier, donne ; sinon aucun.
   * L'auteur de l'inscription n'en est pas : il vient de voir la confirmation (IN-5). Une inscription
   * de secours ne compte pas : aucun (IN-4).
   */
  listOversubscriptionRecipientsAfterSigningUp(
    signUp: SignUp,
    catalogue: ScenarioCatalogue,
    collaborators: SignUpCollaborators,
  ): string[] {
    const game = collaborators.schedule.findExistingGameById(signUp.gameId);
    const { maxSeats } = catalogue.findExistingEntryById(game.scenarioId);
    const signedUp = this.listActiveParticipantIdsOfGame(game, collaborators);
    if (!signedUp.includes(signUp.participantId) || signedUp.length !== maxSeats + 1) return [];
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

  /** Le participant a une inscription active sur une partie qui commence sur le créneau (IN-4). */
  private hasActiveSignUpOnTimeSlot(
    participantId: string,
    timeSlotId: string,
    collaborators: SignUpCollaborators,
  ): boolean {
    return this.signUps.some(
      (signUp) =>
        signUp.participantId === participantId &&
        collaborators.schedule.findExistingGameById(signUp.gameId).timeSlotIds[0] === timeSlotId &&
        this.isActive(signUp, collaborators),
    );
  }

  /** La partie garde ses inscriptions dans le Programme `next` : elle y est, sur les mêmes créneaux (IN-6). */
  private static isGameKeepingSignUps(game: Game, next: Schedule): boolean {
    return next.hasGameOnSameTimeSlots(game);
  }

  /** L'inscription est active : voir `SignUps.isSignUpActive()`. */
  /**
   * L'inscription est de secours : son participant mène, sur l'un des créneaux de la partie, une
   * autre partie (IN-4).
   */
  private isBackup(
    { participantId, gameId }: SignUp,
    { schedule, ledGames }: Pick<SignUpCollaborators, 'schedule' | 'ledGames'>,
  ): boolean {
    const game = schedule.findExistingGameById(gameId);
    return ledGames
      .listGamesLedByParticipant(participantId)
      .some((led) => led.id !== gameId && game.timeSlotIds.some((id) => led.isOnTimeSlot(id)));
  }

  private isActive(
    signUp: SignUp,
    { schedule, ledGames, playedTimeSlots }: SignUpCollaborators,
  ): boolean {
    return SignUps.isSignUpActive(
      schedule.findExistingGameById(signUp.gameId).timeSlotIds,
      ledGames.listGamesLedByParticipant(signUp.participantId).flatMap((game) => game.timeSlotIds),
      playedTimeSlots.listTimeSlotIdsPlayedByParticipant(signUp.participantId),
    );
  }
}

/** Le MJ du participant mène une partie sur le créneau (IN-4). */
function isLeadingOnTimeSlot(
  participantId: string,
  timeSlotId: string,
  ledGames: LedGames,
): boolean {
  return ledGames
    .listGamesLedByParticipant(participantId)
    .some((game) => game.isOnTimeSlot(timeSlotId));
}

/**
 * Le participant est pris sur le créneau : son MJ y mène (IN-4), ou il y joue une partie double où
 * un tirage publié l'a placé (TI-3). Son état sans partie y est ignoré.
 */
function isTakenOnTimeSlot(
  participantId: string,
  timeSlotId: string,
  { ledGames, playedTimeSlots }: SignUpCollaborators,
): boolean {
  return (
    isLeadingOnTimeSlot(participantId, timeSlotId, ledGames) ||
    playedTimeSlots.listTimeSlotIdsPlayedByParticipant(participantId).includes(timeSlotId)
  );
}
