// Le faux service de push, par HTTP, avec de vrais messages chiffrés par `web-push`, comme l'API.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { Agent, request } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import webpush, { type PushSubscription } from 'web-push';
import { startFakePush, type FakePush } from './fake-push.ts';

const certificates = mkdtempSync(join(tmpdir(), 'fake-push-'));
execFileSync(join(import.meta.dirname, 'make-certificate.sh'), [
  join(certificates, 'ca'),
  join(certificates, 'tls'),
  'localhost',
]);
const ca = readFileSync(join(certificates, 'ca', 'ca.pem'));
const agent = new Agent({ ca });
const vapid = webpush.generateVAPIDKeys();

function sendThroughWebPush(subscription: PushSubscription, message: unknown) {
  return webpush.sendNotification(subscription, JSON.stringify(message), {
    agent,
    vapidDetails: {
      subject: 'https://test2.nekbet.fr',
      publicKey: vapid.publicKey,
      privateKey: vapid.privateKey,
    },
  });
}

/** Un message que personne ne peut déchiffrer, posté sur l'adresse d'un abonnement. */
function postUnreadable(endpoint: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const sent = request(endpoint, { method: 'POST', agent }, (response) => {
      response.resume();
      resolve(response.statusCode!);
    });
    sent.on('error', reject);
    sent.end(Buffer.from('pas un message chiffré'));
  });
}

async function admin(fakePush: FakePush, method: string, path: string): Promise<any> {
  const response = await fetch(`${fakePush.adminOrigin}${path}`, { method });
  assert.equal(response.ok, true, `${method} ${path} : ${response.status}`);
  return response.json();
}

function startWithDelay(delayMs: number): Promise<FakePush> {
  return startFakePush({
    pushHost: 'localhost',
    pushPort: 0,
    adminPort: 0,
    delayMs,
    tls: {
      key: readFileSync(join(certificates, 'tls', 'key.pem')),
      cert: readFileSync(join(certificates, 'tls', 'cert.pem')),
    },
  });
}

after(() => rmSync(certificates, { recursive: true, force: true }));

describe('fake-push', () => {
  let fakePush: FakePush;
  before(async () => (fakePush = await startWithDelay(0)));
  after(() => fakePush.close());
  beforeEach(() => admin(fakePush, 'POST', '/reset'));

  it('donne un abonnement en https, avec une vraie clé P-256 et un secret de 16 octets', async () => {
    const subscription = await admin(fakePush, 'POST', '/subscriptions');

    assert.match(subscription.endpoint, /^https:\/\/localhost:\d+\/push\/.+$/);
    assert.equal(Buffer.from(subscription.keys.p256dh, 'base64url').length, 65);
    assert.equal(Buffer.from(subscription.keys.auth, 'base64url').length, 16);
  });

  it('déchiffre chaque message, et le compte par abonnement', async () => {
    const first = await admin(fakePush, 'POST', '/subscriptions');
    const second = await admin(fakePush, 'POST', '/subscriptions');

    const response = await sendThroughWebPush(first, { code: 'draw-published' });
    await sendThroughWebPush(first, { code: 'draw-published' });
    await sendThroughWebPush(second, { code: 'draw-published' });

    assert.equal(response.statusCode, 201);
    const stats = await admin(fakePush, 'GET', '/stats');
    assert.equal(stats.readable, 3);
    assert.equal(stats.unreadable, 0);
    assert.deepEqual(Object.values(stats.readableBySubscription), [2, 1]);
    assert.ok(Date.parse(stats.firstReceivedAt) <= Date.parse(stats.lastReceivedAt));
  });

  it('compte à part un message illisible, et répond quand même 201', async () => {
    const subscription = await admin(fakePush, 'POST', '/subscriptions');

    const status = await postUnreadable(subscription.endpoint);

    assert.equal(status, 201);
    const stats = await admin(fakePush, 'GET', '/stats');
    assert.equal(stats.readable, 0);
    assert.equal(stats.unreadable, 1);
  });

  it('remet tout à zéro, abonnements compris', async () => {
    const subscription = await admin(fakePush, 'POST', '/subscriptions');
    await sendThroughWebPush(subscription, { code: 'draw-published' });

    await admin(fakePush, 'POST', '/reset');
    await sendThroughWebPush(subscription, { code: 'draw-published' });

    const stats = await admin(fakePush, 'GET', '/stats');
    assert.equal(stats.readable, 0);
    assert.equal(stats.unreadable, 1);
    assert.equal(stats.subscriptions, 0);
    assert.deepEqual(stats.readableBySubscription, {});
  });
});

describe('fake-push avec un délai de réponse', () => {
  let fakePush: FakePush;
  before(async () => (fakePush = await startWithDelay(300)));
  after(() => fakePush.close());

  it('répond 201 après DELAY_MS', async () => {
    const subscription = await admin(fakePush, 'POST', '/subscriptions');

    const start = performance.now();
    const response = await sendThroughWebPush(subscription, { code: 'draw-published' });

    assert.equal(response.statusCode, 201);
    assert.ok(performance.now() - start >= 300);
  });
});
