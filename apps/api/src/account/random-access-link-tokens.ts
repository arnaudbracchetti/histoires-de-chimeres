import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AccessLinkTokens } from '@chimeres/application';

/**
 * Jetons des liens d'accès (ADR 0018) : 256 bits de `crypto.randomBytes`, en base64url. La base
 * n'en garde que le SHA-256, en hexadécimal.
 */
@Injectable()
export class RandomAccessLinkTokens implements AccessLinkTokens {
  generate(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
