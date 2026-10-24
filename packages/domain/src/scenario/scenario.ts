import type { Convention } from '../convention/convention.js';
import { Refusal } from '../refusal.js';
import { ContentWarnings } from './content-warnings.js';
import { Seats } from './seats.js';

/** Durée d'un scénario : un ou deux créneaux. */
export type Duration = 1 | 2;

/** Le contenu d'un scénario, tel qu'il est saisi. */
export type ScenarioContent = {
  title: string;
  system: string;
  /** En Markdown restreint aux paragraphes, au gras, à l'italique et aux listes (PR-1). */
  presentation: string;
  /** Vide sans avertissement. */
  contentWarnings: string;
};

/** Ce qu'on saisit pour proposer un scénario : son contenu, ses places et sa durée. */
export type ScenarioDetails = ScenarioContent & {
  seats: { min: number; max: number };
  duration: Duration;
};

export type ScenarioState = {
  id: string;
  /** Le MJ, fixé à la création (PR-16). */
  gameMasterId: string;
  title: string;
  system: string;
  presentation: string;
  contentWarnings: ContentWarnings;
  seats: Seats;
  duration: Duration;
  /** Référence opaque de l'image (ADR 0007), ou `null` : l'illustration par défaut (PR-7). */
  imageId: string | null;
};

/** Scénario : ce qu'un MJ propose de faire jouer. Agrégat à part de la convention (ADR 0005). */
export class Scenario {
  /** Les bornes du contenu (PR-1), reprises par `contract` ; un test d'`application` vérifie qu'elles concordent. */
  static readonly TITLE_MAX_LENGTH = 80;
  static readonly SYSTEM_MAX_LENGTH = 60;
  static readonly PRESENTATION_MAX_LENGTH = 1500;

  private constructor(private state: ScenarioState) {}

  static restore(state: ScenarioState): Scenario {
    return new Scenario({ ...state });
  }

  /**
   * Fabrique un scénario neuf. Seule `Convention.proposeScenario()` l'appelle, après avoir vérifié
   * que le MJ existe.
   */
  static propose(id: string, gameMasterId: string, details: ScenarioDetails): Scenario {
    return new Scenario({
      id,
      gameMasterId,
      ...verifyContent(details),
      seats: Seats.of(details.seats.min, details.seats.max),
      duration: details.duration,
      imageId: null,
    });
  }

  get id(): string {
    return this.state.id;
  }

  get gameMasterId(): string {
    return this.state.gameMasterId;
  }

  get title(): string {
    return this.state.title;
  }

  get system(): string {
    return this.state.system;
  }

  get presentation(): string {
    return this.state.presentation;
  }

  get contentWarnings(): ContentWarnings {
    return this.state.contentWarnings;
  }

  get seats(): Seats {
    return this.state.seats;
  }

  get duration(): Duration {
    return this.state.duration;
  }

  get imageId(): string | null {
    return this.state.imageId;
  }

  /** Le contenu reste modifiable à tout moment (PR-14). */
  changeContent(content: ScenarioContent): void {
    this.state = { ...this.state, ...verifyContent(content) };
  }

  changeSeats({ min, max }: { min: number; max: number }): void {
    this.state.seats = Seats.of(min, max);
  }

  /** La durée ne change plus dès qu'une partie du scénario est programmée (PR-14). */
  changeDuration(duration: Duration, convention: Convention): void {
    if (duration === this.state.duration) return;
    if (convention.scenarioHasGames(this.id)) throw new Refusal('scenario-duration-locked', {});
    this.state.duration = duration;
  }

  /** L'image change à tout moment, même quand le scénario est programmé (PR-7). */
  changeImage(imageId: string): void {
    this.state.imageId = imageId;
  }

  removeImage(): void {
    this.state.imageId = null;
  }

  /**
   * Vérifie que le scénario peut être supprimé : il n'a aucune partie (PR-14). Le repository le
   * supprime ensuite.
   */
  remove(convention: Convention): void {
    if (convention.scenarioHasGames(this.id)) throw new Refusal('scenario-has-games', {});
  }
}

/** Vérifie le contenu, champ par champ dans l'ordre de la saisie, et le renvoie sans les espaces autour. */
function verifyContent(content: ScenarioContent) {
  return {
    title: verifyText(content.title, Scenario.TITLE_MAX_LENGTH, 'scenario-title'),
    system: verifyText(content.system, Scenario.SYSTEM_MAX_LENGTH, 'system'),
    presentation: verifyText(
      content.presentation,
      Scenario.PRESENTATION_MAX_LENGTH,
      'presentation',
    ),
    contentWarnings: ContentWarnings.of(content.contentWarnings),
  };
}

function verifyText(
  text: string,
  max: number,
  codePrefix: 'scenario-title' | 'system' | 'presentation',
) {
  const trimmed = text.trim();
  if (!trimmed) throw new Refusal(`${codePrefix}-required`, {});
  if (trimmed.length > max) throw new Refusal(`${codePrefix}-too-long`, { max });
  return trimmed;
}
