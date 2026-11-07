import { describe, expect, it } from 'vitest';
import {
  buildGameMovedText,
  buildGameUnscheduledText,
  buildCancelledAlertText,
  buildNewGameText,
  buildOwnGameUnscheduledText,
  buildUnassignedText,
} from './change-texts.js';
import { fr } from './french.js';

describe('Textes d’un geste qui rouvre les inscriptions d’un créneau en tirage (NO-2)', () => {
  const REOPENED = 'Les inscriptions du créneau sont rouvertes.';

  it('« nouvelle partie » finit par la réouverture', () => {
    expect(
      buildNewGameText(
        [2],
        { title: 'Néons', system: 'Cyberpunk', tableName: 'Licorne' },
        { reopened: true, backup: false },
      ).body,
    ).toBe(`Néons · Cyberpunk, table Licorne. Tu peux t'y inscrire. ${REOPENED}`);
  });

  it('« partie retirée du programme », à ses inscrits, sans partie compris, et à son MJ', () => {
    expect(buildGameUnscheduledText([2], 'Néons', false, true).body).toBe(
      fr`Néons est retirée : ton inscription est supprimée. ${REOPENED}`,
    );
    expect(buildGameUnscheduledText([2], 'Néons', true, true).body).toBe(
      fr`Néons est retirée : ton inscription est supprimée. Tu restes dans le tirage du créneau 2 : inscris-toi à une autre partie pour avoir une table. ${REOPENED}`,
    );
    expect(buildOwnGameUnscheduledText([2], 'Néons', { reopened: true, backupSignUps: false }).body).toBe(
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
    expect(buildOwnGameUnscheduledText([2], 'Néons', { reopened: false, backupSignUps: false }).body).not.toContain(REOPENED);
  });
});

describe('Textes pour le MJ qui mène sur le créneau (NO-2, IN-4)', () => {
  it('« nouvelle partie » lui propose de s’y inscrire en secours', () => {
    expect(
      buildNewGameText(
        [2],
        { title: 'Néons', system: 'Cyberpunk', tableName: 'Licorne' },
        { reopened: false, backup: true },
      ),
    ).toEqual({
      title: fr`Créneau 2 : nouvelle partie`,
      body: fr`Néons · Cyberpunk, table Licorne. Tu peux t'y inscrire en secours, au cas où ta partie serait annulée.`,
    });
  });

  it('« partie retirée du programme » lui dit que ses inscriptions de secours comptent désormais', () => {
    expect(buildOwnGameUnscheduledText([2], 'Néons', { reopened: false, backupSignUps: true })).toEqual({
      title: fr`Créneau 2 : partie retirée du programme`,
      body: fr`Néons est retirée : tes inscriptions de secours sur ce créneau comptent désormais.`,
    });
  });
});

describe('Alerte du MJ dont la partie annulée quitte le programme à la publication (NO-5, TI-7)', () => {
  it('reprend le titre de la notification, sans les tables où il reste de la place', () => {
    expect(buildCancelledAlertText([2, 3], 'Sc Double')).toEqual({
      title: fr`Créneaux 2 et 3 : ta partie est annulée`,
      body: fr`Sc Double n'a pas atteint son minimum.`,
    });
  });
});

describe('« Pas de place pour toi » à la publication (NO-2)', () => {
  it('dit au participant inscrit que ses parties sont complètes', () => {
    expect(buildUnassignedText(2, ['T1', 'T3'], false)).toEqual({
      title: fr`Créneau 2 : pas de place pour toi`,
      body: fr`Les parties que tu avais choisies sont complètes. Il reste de la place aux tables T1 et T3 : va voir leur MJ.`,
    });
  });

  it('dit au participant sans partie qu’il n’avait plus d’inscription', () => {
    expect(buildUnassignedText(2, ['T1', 'T3'], true).body).toBe(
      fr`Tu n'avais plus d'inscription sur ce créneau. Il reste de la place aux tables T1 et T3 : va voir leur MJ.`,
    );
    expect(buildUnassignedText(2, [], true).body).toBe(
      fr`Tu n'avais plus d'inscription sur ce créneau. Toutes les parties du créneau sont complètes.`,
    );
  });
});
