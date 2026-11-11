import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PasswordHasher } from '@chimeres/application';
import type { Password } from '@chimeres/domain';

/** Paramètres recommandés par OWASP pour scrypt : N = 2^17, r = 8, p = 1. */
const COST = 2 ** 17;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
/** 128 × N × r octets, soit 128 Mio : au-dessus de la limite par défaut de Node (32 Mio). */
const MAX_MEMORY = 256 * 1024 * 1024;

/** Le sel fixe du calcul à blanc, quand il n'y a pas de hachage à vérifier. */
const BLANK_SALT = Buffer.alloc(SALT_LENGTH);

/**
 * `scrypt` de `node:crypto` (ADR 0018). Un hachage s'écrit
 * `scrypt$<N>$<r>$<p>$<sel base64url>$<clé base64url>` : il garde ses paramètres, pour pouvoir les
 * renforcer sans rendre illisibles les anciens.
 */
@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: Password): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const options = { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION };
    const key = await derive(password.text, salt, options);
    return [
      'scrypt',
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString('base64url'),
      key.toString('base64url'),
    ].join('$');
  }

  async verify(text: string, hash: string | null): Promise<boolean> {
    const parts = hash?.split('$');
    if (parts?.length !== 6 || parts[0] !== 'scrypt') {
      await derive(text, BLANK_SALT, { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION });
      return false;
    }
    const [, n, r, p, salt, key] = parts as [string, string, string, string, string, string];
    const expected = Buffer.from(key, 'base64url');
    const actual = await derive(text, Buffer.from(salt, 'base64url'), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

function derive(text: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      text.normalize('NFC'),
      salt,
      KEY_LENGTH,
      { ...options, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
