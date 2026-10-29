import { Injectable } from '@angular/core';

/** L'heure du téléphone, injectée pour que `ParticipantData` se teste seul (ADR 0011). */
@Injectable({ providedIn: 'root' })
export class PhoneClock {
  now(): Date {
    return new Date();
  }
}
