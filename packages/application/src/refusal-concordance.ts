import type {
  RefusalParams as ContractRefusalParams,
  SignUpWarningLevel as ContractSignUpWarningLevel,
  SignUpWarningParams as ContractSignUpWarningParams,
} from '@chimeres/contract';
import type {
  RefusalParams as DomainRefusalParams,
  SignUpWarningLevel as DomainSignUpWarningLevel,
  SignUpWarningParams as DomainSignUpWarningParams,
} from '@chimeres/domain';

// Le domaine et le contrat déclarent chacun leurs codes de refus et leurs codes d'avertissement de
// suivi (ADR 0008) : ce fichier ne compile que si les cartes sont identiques, codes et paramètres.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const concordance: Equal<DomainRefusalParams, ContractRefusalParams> = true;
void concordance;

const signUpWarningConcordance: Equal<DomainSignUpWarningParams, ContractSignUpWarningParams> =
  true;
void signUpWarningConcordance;

const signUpWarningLevelConcordance: Equal<DomainSignUpWarningLevel, ContractSignUpWarningLevel> =
  true;
void signUpWarningLevelConcordance;
