// Le faux service de push du test de charge (docs/load-test/plan.md § 6). Il ne partage pas de code
// avec `apps/api/test/fake-push-service.ts`, qui sert la suite HTTP.
import {
  createDecipheriv,
  createECDH,
  hkdfSync,
  randomBytes,
  randomUUID,
  type ECDH,
} from 'node:crypto';
import { createServer as createHttpServer, type IncomingMessage, type Server } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { AddressInfo } from 'node:net';

export type FakePushOptions = {
  /** Le nom d'hôte des adresses d'abonnement, celui du certificat : `fake-push` dans Docker. */
  pushHost: string;
  /** Le port https qui reçoit les messages de l'API (0 : un port libre). */
  pushPort: number;
  /** Le port http d'administration : abonnements, statistiques, remise à zéro (0 : un port libre). */
  adminPort: number;
  /** Le délai avant chaque réponse 201 à l'API. */
  delayMs: number;
  tls: { key: Buffer; cert: Buffer };
};

export type FakePush = {
  /** `http://127.0.0.1:<port>` : le port d'administration. */
  adminOrigin: string;
  close(): Promise<void>;
};

/**
 * Ce que `GET /stats` rend. Les heures sont celles de la réception, en ISO 8601 ; `now`, l'heure de
 * la réponse, permet à k6 de corriger l'écart entre l'horloge du poste et celle du serveur.
 */
export type FakePushStats = {
  now?: string;
  subscriptions: number;
  readable: number;
  unreadable: number;
  firstReceivedAt: string | null;
  lastReceivedAt: string | null;
  /** Les messages lisibles de chaque abonnement, par identifiant. */
  readableBySubscription: Record<string, number>;
};

type Subscription = { ecdh: ECDH; auth: Buffer };

/**
 * Démarre les deux ports : l'envoi (https), où l'API poste ses messages chiffrés, et
 * l'administration (http), où k6 demande ses abonnements et lit les statistiques.
 */
export async function startFakePush(options: FakePushOptions): Promise<FakePush> {
  const subscriptions = new Map<string, Subscription>();
  let stats = emptyStats();

  const pushServer = createHttpsServer(options.tls, (request, response) => {
    readBody(request).then(
      (body) => {
        const receivedAt = new Date().toISOString();
        const id = request.url?.match(/^\/push\/([^/]+)$/)?.[1];
        const subscription = id === undefined ? undefined : subscriptions.get(id);
        if (request.method === 'POST' && id && subscription && isReadable(body, subscription)) {
          stats.readable++;
          stats.firstReceivedAt ??= receivedAt;
          stats.lastReceivedAt = receivedAt;
          stats.readableBySubscription[id] = (stats.readableBySubscription[id] ?? 0) + 1;
        } else {
          stats.unreadable++;
        }
        setTimeout(() => {
          response.statusCode = 201;
          response.end();
        }, options.delayMs);
      },
      () => {
        // Une requête coupée en route : elle ne compte pas, et la connexion est déjà perdue.
        response.destroy();
      },
    );
  });

  const adminServer = createHttpServer((request, response) => {
    const reply = (status: number, body?: unknown) => {
      response.statusCode = status;
      if (body !== undefined) response.setHeader('Content-Type', 'application/json');
      response.end(body === undefined ? undefined : JSON.stringify(body));
    };
    const route = `${request.method} ${request.url}`;
    request.resume();
    if (route === 'POST /subscriptions') {
      const id = randomUUID();
      const ecdh = createECDH('prime256v1');
      ecdh.generateKeys();
      const auth = randomBytes(16);
      subscriptions.set(id, { ecdh, auth });
      stats.subscriptions = subscriptions.size;
      reply(201, {
        endpoint: `https://${options.pushHost}:${portOf(pushServer)}/push/${id}`,
        keys: { p256dh: ecdh.getPublicKey('base64url'), auth: auth.toString('base64url') },
      });
    } else if (route === 'GET /stats') {
      reply(200, { ...stats, now: new Date().toISOString() });
    } else if (route === 'POST /reset') {
      subscriptions.clear();
      stats = emptyStats();
      reply(200, stats);
    } else if (route === 'GET /health') {
      reply(200, { status: 'ok' });
    } else {
      reply(404);
    }
  });

  await listen(pushServer, options.pushPort);
  await listen(adminServer, options.adminPort);
  return {
    adminOrigin: `http://127.0.0.1:${portOf(adminServer)}`,
    close: async () => {
      await Promise.all([close(pushServer), close(adminServer)]);
    },
  };
}

function emptyStats(): FakePushStats {
  return {
    subscriptions: 0,
    readable: 0,
    unreadable: 0,
    firstReceivedAt: null,
    lastReceivedAt: null,
    readableBySubscription: {},
  };
}

/** Lisible : le message se déchiffre (RFC 8291, `aes128gcm`), et son contenu est du JSON. */
function isReadable(body: Buffer, subscription: Subscription): boolean {
  try {
    JSON.parse(decrypt(body, subscription).toString('utf8'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Déchiffre un message Web Push en un seul enregistrement (RFC 8188 et 8291) : l'en-tête donne le
 * sel, la taille d'enregistrement et la clé publique de l'expéditeur.
 */
function decrypt(body: Buffer, { ecdh, auth }: Subscription): Buffer {
  const salt = body.subarray(0, 16);
  const recordSize = body.readUInt32BE(16);
  const keyIdLength = body.readUInt8(20);
  const senderPublicKey = body.subarray(21, 21 + keyIdLength);
  const record = body.subarray(21 + keyIdLength);
  if (record.length > recordSize)
    throw new Error('Plusieurs enregistrements : non pris en charge.');

  const sharedSecret = ecdh.computeSecret(senderPublicKey);
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    ecdh.getPublicKey(),
    senderPublicKey,
  ]);
  const inputKey = Buffer.from(hkdfSync('sha256', sharedSecret, auth, keyInfo, 32));
  const contentKey = hkdfSync('sha256', inputKey, salt, 'Content-Encoding: aes128gcm\0', 16);
  const nonce = hkdfSync('sha256', inputKey, salt, 'Content-Encoding: nonce\0', 12);

  const decipher = createDecipheriv('aes-128-gcm', Buffer.from(contentKey), Buffer.from(nonce));
  decipher.setAuthTag(record.subarray(record.length - 16));
  const padded = Buffer.concat([
    decipher.update(record.subarray(0, record.length - 16)),
    decipher.final(),
  ]);
  // Le dernier enregistrement finit par le délimiteur 2, suivi d'octets nuls de remplissage.
  let end = padded.length - 1;
  while (end >= 0 && padded[end] === 0) end--;
  if (padded[end] !== 2) throw new Error('Délimiteur de fin absent.');
  return padded.subarray(0, end);
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve) => server.listen(port, resolve));
}

function close(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

function portOf(server: Server): number {
  return (server.address() as AddressInfo).port;
}
