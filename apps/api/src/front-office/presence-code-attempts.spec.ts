import { Refusal } from '@chimeres/domain';
import { TooManyAttemptsError } from '../http/too-many-attempts.error.js';
import { PresenceCodeAttempts } from './presence-code-attempts.js';

const MINUTE = 60 * 1000;

describe('Limite d’essais du code de présence (ID-2)', () => {
  let attempts: PresenceCodeAttempts;
  const accepted = () => Promise.resolve('entré');
  const wrong = () => Promise.reject(new Refusal('presence-code-wrong', {}));
  const fail = (ip: string, times: number) =>
    Promise.all(
      Array.from({ length: times }, () => attempts.guard(ip, wrong).catch(() => undefined)),
    );

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2027-03-14T09:00:00Z') });
    attempts = new PresenceCodeAttempts();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('laisse passer le verdict de l’essai', async () => {
    await expect(attempts.guard('203.0.113.1', accepted)).resolves.toBe('entré');
    await expect(attempts.guard('203.0.113.1', wrong)).rejects.toBeInstanceOf(Refusal);
  });

  it('refuse le 21e essai après 20 échecs, même un bon code', async () => {
    await fail('203.0.113.1', 19);
    await expect(attempts.guard('203.0.113.1', accepted)).resolves.toBe('entré');
    await fail('203.0.113.1', 1);

    await expect(attempts.guard('203.0.113.1', accepted)).rejects.toBeInstanceOf(
      TooManyAttemptsError,
    );
  });

  it('compte chaque adresse IP à part', async () => {
    await fail('203.0.113.1', 20);

    await expect(attempts.guard('203.0.113.2', accepted)).resolves.toBe('entré');
  });

  it('oublie un échec au bout de 10 minutes', async () => {
    await fail('203.0.113.1', 1);
    vi.advanceTimersByTime(MINUTE);
    await fail('203.0.113.1', 19);

    vi.advanceTimersByTime(9 * MINUTE);
    await expect(attempts.guard('203.0.113.1', accepted)).resolves.toBe('entré');
    await fail('203.0.113.1', 1);
    await expect(attempts.guard('203.0.113.1', accepted)).rejects.toBeInstanceOf(
      TooManyAttemptsError,
    );
  });

  it('ne compte pas un autre refus comme un échec', async () => {
    const ended = () => Promise.reject(new Refusal('convention-ended', {}));
    for (let attempt = 0; attempt < 20; attempt++) {
      await attempts.guard('203.0.113.1', ended).catch(() => undefined);
    }

    await expect(attempts.guard('203.0.113.1', accepted)).resolves.toBe('entré');
  });

  it('ne laisse pas passer une rafale d’essais simultanés au-delà de 20', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, () => attempts.guard('203.0.113.1', wrong)),
    );

    const tooMany = results.filter(
      (result) => result.status === 'rejected' && result.reason instanceof TooManyAttemptsError,
    );
    expect(tooMany).toHaveLength(10);
  });
});
