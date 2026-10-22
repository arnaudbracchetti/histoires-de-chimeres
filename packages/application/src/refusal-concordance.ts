import type { RefusalParams as ContractRefusalParams } from '@chimeres/contract';
import type { RefusalParams as DomainRefusalParams } from '@chimeres/domain';

// Le domaine et le contrat déclarent chacun leurs codes de refus (ADR 0008) : ce fichier ne
// compile que si les deux cartes sont identiques, codes et paramètres.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const concordance: Equal<DomainRefusalParams, ContractRefusalParams> = true;
void concordance;
