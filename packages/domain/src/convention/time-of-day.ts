const PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Heure de la journée, à la minute, de `00:00` à `23:59` : un créneau ne passe pas minuit. */
export class TimeOfDay {
  private constructor(readonly minutes: number) {}

  /** Lit une heure `HH:MM`. Une autre forme est une erreur de l'appelant, pas un refus. */
  static parse(text: string): TimeOfDay {
    const match = PATTERN.exec(text);
    if (!match) throw new RangeError(`Heure invalide : ${text}`);
    return new TimeOfDay(Number(match[1]) * 60 + Number(match[2]));
  }

  /** Minutes depuis minuit, de 0 à 1439. */
  static fromMinutes(minutes: number): TimeOfDay {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) {
      throw new RangeError(`Heure invalide : ${minutes} minutes`);
    }
    return new TimeOfDay(minutes);
  }

  isBefore(other: TimeOfDay): boolean {
    return this.minutes < other.minutes;
  }

  /** `HH:MM`. */
  toString(): string {
    const hours = Math.floor(this.minutes / 60);
    const minutes = this.minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
}
