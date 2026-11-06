import { describe, expect, it } from 'vitest';
import {
  buildGameMovedText,
  buildGameUnscheduledText,
  buildNewGameText,
  buildOwnGameUnscheduledText,
} from './change-texts.js';
import { fr } from './french.js';

describe('Textes d’un geste qui rouvre les inscriptions d’un créneau en tirage (NO-2)', () => {
  const REOPENED = 'Les inscriptions du créneau sont rouvertes.';

  it('« nouvelle partie » finit par la réouverture', () => {
    expect(
      buildNewGameText([2], { title: 'Néons', system: 'Cyberpunk', tableName: 'Licorne' }, true)
        .body,
    ).toBe(`Néons · Cyberpunk, table Licorne. Tu peux t'y inscrire. ${REOPENED}`);
  });

  it('« partie retirée du programme », à ses inscrits, sans partie compris, et à son MJ', () => {
    expect(buildGameUnscheduledText([2], 'Néons', false, true).body).toBe(
      fr`Néons est retirée : ton inscription est supprimée. ${REOPENED}`,
    );
    expect(buildGameUnscheduledText([2], 'Néons', true, true).body).toBe(
      fr`Néons est retirée : ton inscription est supprimée. Tu restes dans le tirage du créneau 2 : inscris-toi à une autre partie pour avoir une table. ${REOPENED}`,
    );
    expect(buildOwnGameUnscheduledText([2], 'Néons', true).body).toBe(
      fr`Néons est retirée : tu peux t'inscrire sur ce créneau. ${REOPENED}`,
    );
  });

  it('« partie déplacée » finit par la réouverture', () => {
    expect(buildGameMovedText([2], [3], 'Néons', false, true).body).toBe(
      fr`Néons passe au créneau 3 : ton inscription est retirée. Réinscris-toi si l'horaire te va. ${REOPENED}`,
    );
  });

  it('sans réouverture, le corps ne change pas', () => {
    expect(buildGameMovedText([2], [3], 'Néons', false, false).body).not.toContain(REOPENED);
    expect(buildOwnGameUnscheduledText([2], 'Néons', false).body).not.toContain(REOPENED);
  });
});
