// Le plateau des inscriptions, en fonctions pures (docs/load-test/plan.md § 4 et 5).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGN_UPS_SECONDS,
  buildPhoneTimeline,
  chooseGesture,
  chooseGuaranteedGameId,
  isReadOnly,
} from './sign-ups-plan.ts';

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

describe("Le calendrier d'un téléphone pendant les inscriptions", () => {
  it("s'inscrit d'abord dans les 30 premières secondes, puis lit toutes les 30 s", () => {
    const timeline = buildPhoneTimeline(SIGN_UPS_SECONDS, seededRandom(1));
    const [first] = timeline;
    assert.equal(first!.kind, 'first-sign-up');
    assert.ok(first!.atSeconds >= 0 && first!.atSeconds < 30);
    const periodic = timeline.filter((event) => event.kind === 'periodic-read');
    assert.equal(periodic[0]!.atSeconds, first!.atSeconds + 30);
    assert.equal(periodic[1]!.atSeconds, first!.atSeconds + 60);
  });

  it('range ses événements dans le temps, tous dans le plateau', () => {
    const timeline = buildPhoneTimeline(SIGN_UPS_SECONDS, seededRandom(2));
    timeline.forEach((event, index) => {
      assert.ok(event.atSeconds < SIGN_UPS_SECONDS);
      if (index > 0) assert.ok(event.atSeconds >= timeline[index - 1]!.atSeconds);
    });
  });

  it("donne 8 à 10 GET/s à 80 téléphones, et moins d'une écriture par seconde", () => {
    const random = seededRandom(3);
    const phones = 1000;
    let reads = 0;
    let writes = 0;
    for (let phone = 0; phone < phones; phone++) {
      for (const event of buildPhoneTimeline(SIGN_UPS_SECONDS, random)) {
        // Chaque événement finit par une lecture : deux GET.
        reads++;
        if (!isReadOnly(event)) writes++;
      }
    }
    const getsPerSecond = (reads / phones) * 2 * (80 / SIGN_UPS_SECONDS);
    const writesPerSecond = (writes / phones) * (80 / SIGN_UPS_SECONDS);
    assert.ok(getsPerSecond >= 8 && getsPerSecond <= 10, `${getsPerSecond} GET/s`);
    assert.ok(writesPerSecond < 1, `${writesPerSecond} écritures/s`);
  });
});

describe('La partie garantie du téléphone n', () => {
  const games = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('est la partie n mod 6 du créneau mesuré', () => {
    assert.equal(chooseGuaranteedGameId(0, games, null), 'a');
    assert.equal(chooseGuaranteedGameId(8, games, null), 'c');
  });

  it('est la suivante quand le téléphone est celui du MJ de cette partie', () => {
    assert.equal(chooseGuaranteedGameId(8, games, 'c'), 'd');
    assert.equal(chooseGuaranteedGameId(5, games, 'f'), 'a');
  });
});

describe("Le geste au hasard d'un téléphone", () => {
  const measuredGameIds = ['a', 'b', 'c', 'd', 'e', 'f'];
  const always = (value: number) => () => value;

  it("s'inscrit à une partie où il n'est pas encore, et jamais à celle de son MJ", () => {
    const gesture = chooseGesture(always(0), {
      measuredGameIds,
      signedUpGameIds: ['a', 'c'],
      guaranteedGameId: 'a',
      ledGameId: 'b',
    });
    assert.deepEqual(gesture, { kind: 'signUp', gameId: 'd' });
  });

  it('se désinscrit sans jamais toucher à sa partie garantie', () => {
    const gesture = chooseGesture(always(0.8), {
      measuredGameIds,
      signedUpGameIds: ['a', 'e'],
      guaranteedGameId: 'a',
      ledGameId: null,
    });
    assert.deepEqual(gesture, { kind: 'withdraw', gameId: 'e' });
  });

  it("s'inscrit quand il n'a rien d'autre que sa partie garantie à quitter", () => {
    const gesture = chooseGesture(always(0.8), {
      measuredGameIds,
      signedUpGameIds: ['a'],
      guaranteedGameId: 'a',
      ledGameId: null,
    });
    assert.deepEqual(gesture, { kind: 'signUp', gameId: 'f' });
  });

  it('se désinscrit quand il est déjà inscrit partout', () => {
    const gesture = chooseGesture(always(0), {
      measuredGameIds,
      signedUpGameIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      guaranteedGameId: 'a',
      ledGameId: null,
    });
    assert.deepEqual(gesture, { kind: 'withdraw', gameId: 'b' });
  });

  it("s'inscrit 7 fois sur 10 quand les deux gestes sont possibles", () => {
    const random = seededRandom(4);
    let signUps = 0;
    for (let trial = 0; trial < 10_000; trial++) {
      const gesture = chooseGesture(random, {
        measuredGameIds,
        signedUpGameIds: ['a', 'b'],
        guaranteedGameId: 'a',
        ledGameId: null,
      });
      if (gesture.kind === 'signUp') signUps++;
    }
    assert.ok(signUps > 6_800 && signUps < 7_200, `${signUps} inscriptions`);
  });
});
