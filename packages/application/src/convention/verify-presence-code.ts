import type { Clock } from '../clock.js';
import type { ConventionRepository } from './convention-repository.js';

/** Vérifier le code de présence (ID-2) : la convention en rend le verdict, rien ne change. */
export class VerifyPresenceCode {
  constructor(
    private readonly repository: ConventionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(presented: string): Promise<void> {
    const convention = await this.repository.get();
    convention.verifyPresenceCode(presented, this.clock.now());
  }
}
