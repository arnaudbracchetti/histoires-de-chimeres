import type { Password } from '@chimeres/domain';

/** Port du hachage des mots de passe (ADR 0018) : le domaine ne reçoit que le hachage. */
export interface PasswordHasher {
  /** Le hachage d'un mot de passe vérifié par le domaine. */
  hash(password: Password): Promise<string>;
  /**
   * Le texte saisi correspond au hachage. Sans hachage (pseudo inconnu, mot de passe pas encore
   * choisi), rend faux après le même temps de calcul : la durée ne dit pas si le pseudo a un compte.
   */
  verify(text: string, hash: string | null): Promise<boolean>;
}
