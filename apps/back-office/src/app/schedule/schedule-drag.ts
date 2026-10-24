import type { CdkDragMove, DragRef, Point } from '@angular/cdk/drag-drop';
import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  scheduleEndpoints,
  type GameDto,
  type MovePlacementDto,
  type PlacementDto,
  type ScheduleScenarioDto,
  type VerdictRefusalDto,
} from '@chimeres/contract';
import { apiResource } from '../api-resource';

/** Ce qu'on glisse : un scénario de la réserve, ou une partie de la frise. */
export type DragSubject =
  { kind: 'scenario'; scenario: ScheduleScenarioDto } | { kind: 'game'; game: GameDto };

/** Une case de la frise : un créneau (pour une partie double, son premier) et une table. */
export type Place = { timeSlotId: string; tableId: string };

/**
 * Où l'on dépose : une case de la frise, avec la partie qui l'occupe (sa case est celle de son
 * premier créneau), ou le bac de réserve.
 */
export type DropTarget = ({ kind: 'cell'; gameId: string | null } & Place) | { kind: 'reserve' };

/** Un dépôt sur une cible valide. */
export type Drop = { subject: DragSubject; target: DropTarget };

/**
 * L'état d'une cible pendant le geste : `idle` hors geste, ou tant que son verdict n'est pas lu ;
 * `source` pour la place de la partie saisie ; `valid` s'éclaire ; `refused` reste éteinte, avec
 * son motif.
 */
export type TargetState =
  { kind: 'idle' | 'source' | 'valid' } | { kind: 'refused'; refusal: VerdictRefusalDto };

const IDLE: TargetState = { kind: 'idle' };

/**
 * Le glisser-déposer du Calendrier (docs/design/patterns.md, Programmation), partagé par la frise,
 * le bac de réserve et la page qui les porte. Au début du geste, il lit les verdicts du scénario ou
 * de la partie saisis ; le front ne recalcule pas PR-5. Les cibles se trouvent sous le pointeur par
 * leurs attributs : `data-drop-time-slot`, `data-drop-table` et `data-drop-game` pour une case,
 * `data-drop-reserve` pour le bac. Pendant le geste, `<html>` porte `dragging`, et `drop-refused`
 * au-dessus d'une cible refusée : le curseur suit (styles.css).
 */
@Injectable()
export class ScheduleDrag {
  readonly subject = signal<DragSubject | null>(null);
  /** La cible sous le pointeur, ou `null`. */
  readonly hovered = signal<DropTarget | null>(null);
  /** Le dépôt lâché sur une cible valide, en attendant la fin du geste. */
  private landing: Drop | null = null;

  private readonly scenarioPlacements = apiResource(scheduleEndpoints.placements, () => {
    const subject = this.subject();
    return subject?.kind === 'scenario' ? { scenarioId: subject.scenario.id } : undefined;
  });
  private readonly gamePlacements = apiResource(scheduleEndpoints.movePlacements, () => {
    const subject = this.subject();
    return subject?.kind === 'game' ? { gameId: subject.game.id } : undefined;
  });

  /** Les verdicts des cases pour le geste en cours ; aucun tant qu'ils ne sont pas lus. */
  private readonly verdicts = computed<readonly (PlacementDto | MovePlacementDto)[]>(() => {
    const subject = this.subject();
    const placements = subject?.kind === 'game' ? this.gamePlacements : this.scenarioPlacements;
    return (subject && placements.hasValue() && placements.value()) || [];
  });

  /** Le bac s'éclaire pendant le geste d'une partie : on l'y dépose pour la déprogrammer. */
  readonly reserveIsValid = computed(() => this.subject()?.kind === 'game');

  /** La cible survolée est refusée. */
  private readonly overRefused = computed(() => {
    const hovered = this.hovered();
    return !!hovered && this.stateOf(hovered).kind === 'refused';
  });

  constructor() {
    // L'aperçu laisse passer le pointeur : sans cela, le curseur serait celui de la page dessous.
    const root = inject(DOCUMENT).documentElement;
    effect(() => {
      root.classList.toggle('dragging', !!this.subject());
      root.classList.toggle('drop-refused', this.overRefused());
    });
  }

  /** La phrase complète du motif de la cible survolée, pour la barre d'aide. */
  readonly help = computed(() => {
    const hovered = this.hovered();
    const state = hovered ? this.stateOf(hovered) : IDLE;
    return state.kind === 'refused' ? state.refusal.detail : '';
  });

  stateOf(target: DropTarget): TargetState {
    const subject = this.subject();
    if (!subject) return IDLE;
    if (target.kind === 'reserve') return this.reserveIsValid() ? { kind: 'valid' } : IDLE;
    if (subject.kind === 'game' && isPlaceOf(subject.game, target)) return { kind: 'source' };
    const verdict = this.verdicts().find(
      ({ timeSlotId, tableId }) => timeSlotId === target.timeSlotId && tableId === target.tableId,
    );
    if (!verdict) return IDLE;
    return verdict.refusal ? { kind: 'refused', refusal: verdict.refusal } : { kind: 'valid' };
  }

  start(subject: DragSubject) {
    this.subject.set(subject);
    this.hovered.set(null);
  }

  /**
   * Suit le pointeur : la barre d'aide parle de la cible qu'il survole. Le CDK donne la position de
   * l'aperçu (`byThumbnail`) : la cible se lit sur l'événement lui-même.
   */
  move({ event }: CdkDragMove) {
    const { clientX, clientY } =
      'touches' in event ? (event.touches[0] ?? event.changedTouches[0]!) : event;
    const target = targetAt(clientX, clientY);
    if (!sameTarget(target, this.hovered())) this.hovered.set(target);
  }

  /**
   * Place l'aperçu comme si on l'avait saisi par sa vignette, centrée sous le pointeur, où qu'on
   * ait saisi la carte : l'image, le plus visible, montre la case où l'on dépose. Renvoie le coin
   * haut gauche de l'aperçu (`cdkDragConstrainPosition`), mesuré sur la carte restée en filigrane.
   */
  readonly byThumbnail = (pointer: Point, ref: DragRef, _: DOMRect, pickup: Point): Point => {
    const card = ref.getPlaceholderElement();
    const thumbnail = card.querySelector('app-scenario-illustration');
    if (!thumbnail) return { x: pointer.x - pickup.x, y: pointer.y - pickup.y };
    const { left, top } = card.getBoundingClientRect();
    const image = thumbnail.getBoundingClientRect();
    return {
      x: pointer.x - (image.left - left + image.width / 2),
      y: pointer.y - (image.top - top + image.height / 2),
    };
  };

  /**
   * Lâche l'élément sur la cible survolée. Sur une cible valide, l'aperçu ne revient pas à sa place
   * d'origine : l'élément prendra sa nouvelle place à la fin du geste (`end()`). Ailleurs, il y
   * revient.
   */
  release() {
    const subject = this.subject();
    const target = this.hovered();
    const state = target ? this.stateOf(target) : IDLE;
    this.subject.set(null);
    this.hovered.set(null);
    this.landing = null;
    if (!subject || !target || state.kind !== 'valid') return;
    this.landing = { subject, target };
    document.querySelector('.cdk-drag-preview')?.classList.add('landing');
  }

  /**
   * Le geste est fini, et le CDK a rendu sa place à l'élément : le dépôt à écrire, ou `null`. La
   * frise ne change qu'à ce moment-là, sinon elle déplacerait l'élément sous les pieds du CDK.
   */
  end(): Drop | null {
    const drop = this.landing;
    this.landing = null;
    return drop;
  }
}

function isPlaceOf(game: GameDto, { timeSlotId, tableId }: Place) {
  return game.timeSlotIds[0] === timeSlotId && game.tableId === tableId;
}

function targetAt(x: number, y: number): DropTarget | null {
  const element = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>('[data-drop-time-slot], [data-drop-reserve]');
  if (!element) return null;
  const { dropTimeSlot, dropTable, dropGame } = element.dataset;
  if (dropTimeSlot === undefined) return { kind: 'reserve' };
  return { kind: 'cell', timeSlotId: dropTimeSlot, tableId: dropTable!, gameId: dropGame || null };
}

function sameTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  if (a?.kind === 'cell' && b?.kind === 'cell') {
    return a.timeSlotId === b.timeSlotId && a.tableId === b.tableId && a.gameId === b.gameId;
  }
  return a?.kind === b?.kind;
}
