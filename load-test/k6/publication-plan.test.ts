// Le pic de publication, en fonctions pures (docs/load-test/plan.md § 2 et 4).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PEAK_SECONDS,
  PUBLICATION_SECONDS,
  PUBLISH_SECONDS,
  buildPublicationTimeline,
  isApplicationClosed,
} from './publication-plan.ts';

/** Un tirage au hasard reproductible (mulberry32). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Le pic de publication', () => {
  it("publie 30 s après le lancement du tirage, et fixe l'instant du pic juste après", () => {
    assert.equal(PUBLISH_SECONDS, 30);
    assert.ok(PEAK_SECONDS > PUBLISH_SECONDS && PEAK_SECONDS <= PUBLISH_SECONDS + 5);
  });

  it("ferme l'application d'un téléphone sur cinq", () => {
    const closed = Array.from({ length: 80 }, (_, index) => index).filter(isApplicationClosed);
    assert.equal(closed.length, 16);
  });

  it("ne ferme l'application d'aucun téléphone de MJ, qui saisit son pseudo en dixième", () => {
    const gameMasters = [9, 19, 29, 39, 49, 59, 69, 79];
    assert.deepEqual(gameMasters.filter(isApplicationClosed), []);
  });

  it('fait relire une page ouverte dans les 2 s du pic, une seule fois', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const timeline = buildPublicationTimeline(1, seededRandom(seed));
      const peak = timeline.filter((event) => event.kind === 'peak-read');
      assert.equal(peak.length, 1);
      assert.ok(peak[0]!.atSeconds >= PEAK_SECONDS && peak[0]!.atSeconds < PEAK_SECONDS + 2);
      assert.equal(timeline.filter((event) => event.kind === 'peak-opening').length, 0);
    }
  });

  it("fait ouvrir l'application fermée dans les 60 s du pic, une seule fois", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const timeline = buildPublicationTimeline(0, seededRandom(seed));
      const opening = timeline.filter((event) => event.kind === 'peak-opening');
      assert.equal(opening.length, 1);
      assert.ok(opening[0]!.atSeconds >= PEAK_SECONDS && opening[0]!.atSeconds < PEAK_SECONDS + 60);
      assert.equal(timeline.filter((event) => event.kind === 'peak-read').length, 0);
    }
  });

  it('continue les relectures des 30 s de la page ouverte, du début à la fin de la phase', () => {
    const timeline = buildPublicationTimeline(1, seededRandom(3));
    const periodic = timeline.filter((event) => event.kind === 'periodic-read');
    assert.ok(periodic[0]!.atSeconds < 30);
    for (let rank = 1; rank < periodic.length; rank++) {
      assert.equal(periodic[rank]!.atSeconds - periodic[rank - 1]!.atSeconds, 30);
    }
    assert.ok(periodic.at(-1)!.atSeconds >= PUBLICATION_SECONDS - 30);
    assert.ok(periodic.at(-1)!.atSeconds < PUBLICATION_SECONDS);
  });

  it("ne relit l'application fermée qu'après son ouverture, puis toutes les 30 s", () => {
    const timeline = buildPublicationTimeline(0, seededRandom(4));
    const opening = timeline.find((event) => event.kind === 'peak-opening')!;
    const periodic = timeline.filter((event) => event.kind === 'periodic-read');
    periodic.forEach((event, rank) => {
      assert.equal(event.atSeconds, opening.atSeconds + 30 * (rank + 1));
    });
    assert.ok(periodic.every((event) => event.atSeconds < PUBLICATION_SECONDS));
  });

  it("rend le calendrier dans l'ordre du temps", () => {
    const timeline = buildPublicationTimeline(1, seededRandom(5));
    const times = timeline.map((event) => event.atSeconds);
    assert.deepEqual(
      times,
      [...times].sort((a, b) => a - b),
    );
  });
});
