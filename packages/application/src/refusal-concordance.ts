import type {
  DrawSignalParams as ContractDrawSignalParams,
  RefusalParams as ContractRefusalParams,
  SignUpWarningParams as ContractSignUpWarningParams,
  StatusLevel as ContractStatusLevel,
} from '@chimeres/contract';
import type {
  DrawSignalParams as DomainDrawSignalParams,
  RefusalParams as DomainRefusalParams,
  SignUpWarningParams as DomainSignUpWarningParams,
  StatusLevel as DomainStatusLevel,
} from '@chimeres/domain';

// Le domaine et le contrat déclarent chacun leurs codes de refus, leurs codes d'avertissement de
// suivi, leurs codes de signal du tirage et le niveau d'un statut (ADR 0008) : ce fichier ne
// compile que si les cartes sont identiques, codes et paramètres.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const concordance: Equal<DomainRefusalParams, ContractRefusalParams> = true;
void concordance;

const signUpWarningConcordance: Equal<DomainSignUpWarningParams, ContractSignUpWarningParams> =
  true;
void signUpWarningConcordance;

const drawSignalConcordance: Equal<DomainDrawSignalParams, ContractDrawSignalParams> = true;
void drawSignalConcordance;

const statusLevelConcordance: Equal<DomainStatusLevel, ContractStatusLevel> = true;
void statusLevelConcordance;
