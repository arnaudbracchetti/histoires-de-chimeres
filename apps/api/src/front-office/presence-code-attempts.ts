import { Injectable } from '@nestjs/common';
import { Refusal } from '@chimeres/domain';
import { TooManyAttemptsError } from '../http/too-many-attempts.error.js';

const MAX_FAILURES = 20;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * Limite les essais du code de présence à 20 échecs par adresse IP et par 10 minutes (ID-2), en
 * mémoire : l'API n'a qu'une instance. Au-delà, tout essai est refusé, même un bon code.
 */
@Injectable()
export class PresenceCodeAttempts {
  /** L'heure de chaque échec des 10 dernières minutes, par adresse IP. */
  private readonly failures = new Map<string, number[]>();

  /**
   * Lance l'essai si l'adresse IP y a droit, et compte son refus `presence-code-wrong`. L'essai est
   * compté comme un échec dès son départ, puis retiré s'il n'en est pas un : une rafale d'essais
   * simultanés ne dépasse pas la limite.
   */
  async guard<T>(ip: string, attempt: () => Promise<T>): Promise<T> {
    const now = Date.now();
    this.forgetBefore(now - WINDOW_MS);
    const failures = this.failures.get(ip) ?? [];
    if (failures.length >= MAX_FAILURES) throw new TooManyAttemptsError();
    this.failures.set(ip, [...failures, now]);
    try {
      const result = await attempt();
      this.withdraw(ip, now);
      return result;
    } catch (error) {
      if (!(error instanceof Refusal && error.code === 'presence-code-wrong')) {
        this.withdraw(ip, now);
      }
      throw error;
    }
  }

  /** Retire l'échec compté d'avance à cette heure, s'il n'a pas déjà été oublié. */
  private withdraw(ip: string, time: number): void {
    const failures = this.failures.get(ip) ?? [];
    const index = failures.indexOf(time);
    if (index < 0) return;
    const remaining = failures.toSpliced(index, 1);
    if (remaining.length) this.failures.set(ip, remaining);
    else this.failures.delete(ip);
  }

  private forgetBefore(start: number): void {
    for (const [ip, failures] of this.failures) {
      const recent = failures.filter((time) => time > start);
      if (recent.length) this.failures.set(ip, recent);
      else this.failures.delete(ip);
    }
  }
}
