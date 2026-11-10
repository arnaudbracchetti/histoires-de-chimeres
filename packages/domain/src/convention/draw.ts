import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { Schedule } from './schedule.js';
import type { Table } from './table.js';

/** Une table où il reste de la place, et combien. */
export type TableWithSeats = { tableId: string; freeSeatCount: number };

/** Ce que les places restantes d'un tirage lisent hors du tirage. */
export type TableSeatsCollaborators = {
  schedule: Schedule;
  /** Dans l'ordre naturel. */
  tables: readonly Table[];
  /** Entier : il donne les places maximum des parties. */
  catalogue: ScenarioCatalogue;
};

/**
 * Affectation : le résultat du tirage pour un participant, provisoire ou publié. Sa partie, ou
 * `null` s'il n'est pas placé, et s'il a été déplacé à la main. Value object de l'agrégat
 * Convention, rangé dans les Tirages.
 */
export class Assignment {
  constructor(
    readonly participantId: string,
    readonly gameId: string | null,
    readonly movedByHand: boolean,
  ) {}
}

/**
 * Tirage d'un créneau, lancé : provisoire jusqu'à sa publication. Une affectation par participant
 * du tirage, enregistrés au lancement, et les parties annulées (TI-6). Entité de l'agrégat
 * Convention, rangée dans les Tirages, qui en gardent les règles.
 */
export class Draw {
  constructor(
    readonly timeSlotId: string,
    readonly published: boolean,
    readonly assignments: readonly Assignment[],
    readonly cancelledGameIds: readonly string[] = [],
  ) {}

  isGameCancelled(gameId: string): boolean {
    return this.cancelledGameIds.includes(gameId);
  }

  /** La partie a moins de joueurs que ce minimum, aucun compris : elle peut être annulée (TI-6). */
  hasGameBelowMinimum(gameId: string, minSeats: number): boolean {
    return this.countPlayersOfGame(gameId) < minSeats;
  }

  /** Le nombre de joueurs de la partie : ses affectations, déplacements compris. */
  countPlayersOfGame(gameId: string): number {
    return this.assignments.filter((assignment) => assignment.gameId === gameId).length;
  }

  /** Les joueurs de la partie, dans l'ordre des affectations. */
  listPlayerIdsOfGame(gameId: string): string[] {
    return this.assignments
      .filter((assignment) => assignment.gameId === gameId)
      .map(({ participantId }) => participantId);
  }

  /**
   * Les tables où il reste de la place, et combien, dans l'ordre naturel : celles des
   * parties non annulées qui commencent sur le créneau, sous leurs places maximum. La partie double
   * commencée au créneau d'avant n'en est pas.
   */
  listTablesWithSeats({ schedule, tables, catalogue }: TableSeatsCollaborators): TableWithSeats[] {
    const freeSeatsByTable = new Map(
      schedule
        .listGamesStartingOnTimeSlot(this.timeSlotId)
        .filter((game) => !this.isGameCancelled(game.id))
        .map((game) => [
          game.tableId,
          catalogue.findExistingEntryById(game.scenarioId).maxSeats -
            this.countPlayersOfGame(game.id),
        ]),
    );
    return tables.flatMap((table) => {
      const freeSeatCount = freeSeatsByTable.get(table.id) ?? 0;
      return freeSeatCount > 0 ? [{ tableId: table.id, freeSeatCount }] : [];
    });
  }

  /** Les participants du tirage qui ne sont pas placés, dans l'ordre des affectations. */
  listUnassignedParticipantIds(): string[] {
    return this.assignments
      .filter((assignment) => assignment.gameId === null)
      .map(({ participantId }) => participantId);
  }

  /** L'affectation du participant, ou `undefined` s'il n'est pas du tirage. */
  findAssignmentOfParticipant(participantId: string): Assignment | undefined {
    return this.assignments.find((assignment) => assignment.participantId === participantId);
  }

  /**
   * Le même tirage, publié : son résultat est figé (TI-7). Il ne garde aucune partie annulée : la
   * publication les déprogramme.
   */
  getDrawAfterPublishing(): Draw {
    return new Draw(this.timeSlotId, true, this.assignments, []);
  }

  /** Le participant a une affectation dans ce tirage. */
  hasParticipant(participantId: string): boolean {
    return this.assignments.some((assignment) => assignment.participantId === participantId);
  }

  /**
   * Le même tirage, le participant sur cette partie, ou non placé pour `null`, marqué « déplacé à
   * la main ». Vers sa partie actuelle, rien ne change.
   */
  getDrawAfterMovingParticipant(participantId: string, gameId: string | null): Draw {
    const current = this.assignments.find(
      (assignment) => assignment.participantId === participantId,
    );
    if (current?.gameId === gameId) return this;
    return new Draw(
      this.timeSlotId,
      this.published,
      this.assignments.map((assignment) =>
        assignment.participantId === participantId
          ? new Assignment(participantId, gameId, true)
          : assignment,
      ),
      this.cancelledGameIds,
    );
  }

  /** Le même tirage, le participant en plus, non placé, sans la marque « déplacé à la main ». */
  getDrawAfterAddingUnassignedParticipant(participantId: string): Draw {
    return new Draw(
      this.timeSlotId,
      this.published,
      [...this.assignments, new Assignment(participantId, null, false)],
      this.cancelledGameIds,
    );
  }

  /** Le même tirage, sans l'affectation du participant, qui disparaît (PR-12). */
  getDrawAfterRemovingParticipant(participantId: string): Draw {
    return new Draw(
      this.timeSlotId,
      this.published,
      this.assignments.filter((assignment) => assignment.participantId !== participantId),
      this.cancelledGameIds,
    );
  }

  /**
   * Le même tirage, la partie annulée : ses joueurs passent non placés, sans la marque « déplacé à
   * la main », et le participant de son MJ entre au tirage, non placé.
   */
  getDrawAfterCancellingGame(gameId: string, gameMasterParticipantId: string): Draw {
    return new Draw(
      this.timeSlotId,
      this.published,
      [
        ...this.assignments.map((assignment) =>
          assignment.gameId === gameId
            ? new Assignment(assignment.participantId, null, false)
            : assignment,
        ),
        new Assignment(gameMasterParticipantId, null, false),
      ],
      [...this.cancelledGameIds, gameId],
    );
  }

  /**
   * Le même tirage, la partie rétablie : elle revient sans joueur, et le participant de son MJ sort
   * du tirage, où qu'il soit placé.
   */
  getDrawAfterRestoringGame(gameId: string, gameMasterParticipantId: string): Draw {
    return new Draw(
      this.timeSlotId,
      this.published,
      this.assignments.filter((assignment) => assignment.participantId !== gameMasterParticipantId),
      this.cancelledGameIds.filter((cancelled) => cancelled !== gameId),
    );
  }
}
