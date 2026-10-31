import { describe, expect, it } from 'vitest';
import {
  countOf,
  formatCount,
  formatList,
  formatSeats,
  fr,
  NBSP,
  plural,
  THIN_NBSP,
} from './french.js';

describe('Typographie française', () => {
  it('nomme les espaces de ton.md par leur point de code', () => {
    expect(NBSP).toBe('\u00a0');
    expect(THIN_NBSP).toBe('\u202f');
  });

  it('pose une espace insécable à l’intérieur des guillemets, une fine devant le point d’interrogation', () => {
    const title = 'Brumes';
    expect(fr`Supprimer le scénario « ${title} » ?`).toBe(
      `Supprimer le scénario «${NBSP}Brumes${NBSP}»${THIN_NBSP}?`,
    );
  });

  it('pose une espace insécable devant les deux-points, une fine devant ; et !', () => {
    expect(fr`Pas de connexion : rien n'a été enregistré.`).toBe(
      `Pas de connexion${NBSP}: rien n'a été enregistré.`,
    );
    expect(fr`Un ; deux !`).toBe(`Un${THIN_NBSP}; deux${THIN_NBSP}!`);
  });

  it('ne réécrit jamais une valeur insérée', () => {
    const title = 'Les ombres : acte I ?';
    expect(fr`Partie « ${title} » déprogrammée.`).toBe(
      `Partie «${NBSP}Les ombres : acte I ?${NBSP}» déprogrammée.`,
    );
  });

  it('laisse une heure saisie telle quelle', () => {
    expect(fr`De 00:00 à 23:59.`).toBe('De 00:00 à 23:59.');
  });

  it('sépare les milliers par une espace fine insécable', () => {
    expect(formatCount(42)).toBe('42');
    expect(formatCount(1500)).toBe(`1${THIN_NBSP}500`);
  });

  it('accorde le nom au nombre, singulier pour 0 et 1, et le lie au nombre par une espace insécable', () => {
    expect(plural(0, 'place', 'places')).toBe('place');
    expect(plural(1, 'place', 'places')).toBe('place');
    expect(plural(2, 'place', 'places')).toBe('places');
    expect(countOf(4, 'place', 'places')).toBe(`4${NBSP}places`);
    expect(countOf(1500, 'caractère', 'caractères')).toBe(`1${THIN_NBSP}500${NBSP}caractères`);
  });

  it('énumère avec « et » devant le dernier élément, sans virgule devant lui', () => {
    expect(formatList(['Dragon'])).toBe('Dragon');
    expect(formatList(['Dragon', 'Licorne'])).toBe('Dragon et Licorne');
    expect(formatList(['Dragon', 'Licorne', 'Griffon'])).toBe('Dragon, Licorne et Griffon');
  });

  it('donne les places d’un scénario, « 4 places » quand minimum et maximum sont égaux', () => {
    expect(formatSeats({ min: 3, max: 5 })).toBe(`3 à 5${NBSP}places`);
    expect(formatSeats({ min: 4, max: 4 })).toBe(`4${NBSP}places`);
  });
});
