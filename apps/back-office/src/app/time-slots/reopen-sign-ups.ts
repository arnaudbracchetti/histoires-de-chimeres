import { inject } from '@angular/core';
import { drawEndpoints, type TimeSlotDto } from '@chimeres/contract';
import { fr } from '@chimeres/design';
import { injectApiCall } from '../api-call';
import { Announcer } from '../shell/announcer';
import { Confirmation } from '../ui/confirmation';

/** Rouvre les inscriptions du créneau après confirmation ; vrai si elles sont rouvertes. */
export type ReopenSignUps = (
  timeSlot: Pick<TimeSlotDto, 'id' | 'rank'>,
  onStale: () => void,
) => Promise<boolean>;

/**
 * Renvoie `reopenSignUps(timeSlot, onStale)`, à créer dans un contexte d'injection. Il rouvre les
 * inscriptions d'un créneau en tirage provisoire (TI-6), après une confirmation rouge : le tirage
 * provisoire est effacé. La région `aria-live` l'annonce. Vrai si les inscriptions sont rouvertes.
 * Le pilotage et la fiche d'un pseudo le partagent, confirmation comprise, mot pour mot.
 */
export function injectReopenSignUps(): ReopenSignUps {
  const confirmation = inject(Confirmation);
  const announcer = inject(Announcer);
  const apiCall = injectApiCall();
  return async ({ id, rank }, onStale) => {
    const reopened = await confirmation.ask({
      question: fr`Rouvrir les inscriptions du créneau ${rank} ?`,
      consequences: [
        fr`Le résultat provisoire sera effacé, avec ses déplacements et ses parties annulées.`,
        fr`Personne n'est notifié : chacun retrouve ses inscriptions, et peut en changer jusqu'au prochain tirage.`,
      ],
      confirmLabel: 'Rouvrir les inscriptions',
      action: () => apiCall(drawEndpoints.reopenSignUps, { params: { timeSlotId: id } }),
      onStale,
    });
    if (reopened) announcer.announce(fr`Inscriptions du créneau ${rank} rouvertes.`);
    return reopened;
  };
}
