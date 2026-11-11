import { Inject, Injectable } from '@nestjs/common';
import type { Clock } from '@chimeres/application';
import { ComparableName } from '@chimeres/domain';
import { CLOCK } from '../clock/clock.token.js';
import { TooManyAttemptsError } from '../http/too-many-attempts.error.js';

/** Essais par minute pour un couple (adresse IP, pseudo), puis pour une adresse IP (ADR 0018). */
const MAX_PER_NICKNAME = 5;
const MAX_PER_IP = 30;

/**
 * Limite les essais de connexion, sans jamais bloquer le compte (ADR 0018) : 5 par minute pour un
 * couple (adresse IP, pseudo comparé comme ID-7), 30 par minute pour une adresse IP. Les compteurs
 * restent en mémoire, l'API n'a qu'une instance. La minute est celle de l'horloge de la convention :
 * les compteurs repartent de zéro à chaque nouvelle minute.
 */
@Injectable()
export class LoginAttempts {
  /** La minute en cours, `AAAA-MM-JJ HH:MM`. */
  private minute = '';
  /** Les essais de la minute en cours. */
  private attempts: { ip: string; nickname: ComparableName }[] = [];

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  /** Compte l'essai, ou le refuse par `too-many-login-attempts` au-delà de la limite. */
  count(ip: string, nickname: string): void {
    const { date, time } = this.clock.now();
    const minute = `${date} ${time.toString()}`;
    if (minute !== this.minute) {
      this.minute = minute;
      this.attempts = [];
    }
    const attempt = { ip, nickname: ComparableName.createFromText(nickname) };
    const fromIp = this.attempts.filter((other) => other.ip === ip);
    const forNickname = fromIp.filter((other) => other.nickname.equals(attempt.nickname));
    if (fromIp.length >= MAX_PER_IP || forNickname.length >= MAX_PER_NICKNAME) {
      throw new TooManyAttemptsError('too-many-login-attempts');
    }
    this.attempts.push(attempt);
  }
}
