import { createECDH, randomBytes } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import ece from 'http_ece';
import type { PushSubscriptionBody } from '@chimeres/contract';

/** Une requête reçue par le faux service push, avec son contenu déchiffré. */
export type ReceivedPush = {
  endpoint: string;
  headers: IncomingHttpHeaders;
  message: unknown;
};

/**
 * Faux service push, en HTTP sur le poste : il crée de vrais abonnements (clés du navigateur), et
 * déchiffre ce qu'il reçoit. Chaque endpoint répond 201, sauf les statuts mis en file par
 * `respondWith()`. `hold()` retient les réponses jusqu'à ce qu'on les relâche.
 */
export class FakePushService {
  readonly received: ReceivedPush[] = [];

  private readonly server: Server;
  private readonly keys = new Map<string, { ecdh: ReturnType<typeof createECDH>; auth: Buffer }>();
  private readonly statuses = new Map<string, number[]>();
  private held: Promise<void> | null = null;
  private waiters: (() => void)[] = [];
  private next = 0;

  private constructor() {
    this.server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        void (async () => {
          const endpoint = `${this.origin}${request.url}`;
          const key = this.keys.get(endpoint)!;
          const message: unknown = JSON.parse(
            ece
              .decrypt(Buffer.concat(chunks), {
                version: 'aes128gcm',
                privateKey: key.ecdh,
                authSecret: key.auth.toString('base64url'),
              })
              .toString('utf8'),
          );
          this.received.push({ endpoint, headers: request.headers, message });
          for (const wake of this.waiters.splice(0)) wake();
          await this.held;
          response.statusCode = this.statuses.get(endpoint)?.shift() ?? 201;
          response.end();
        })();
      });
    });
  }

  static async start(): Promise<FakePushService> {
    const service = new FakePushService();
    await new Promise<void>((resolve) => service.server.listen(0, '127.0.0.1', resolve));
    return service;
  }

  get origin(): string {
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  /** Un nouvel abonnement, tel qu'un navigateur le donnerait. */
  subscription(): PushSubscriptionBody {
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    const auth = randomBytes(16);
    const endpoint = `${this.origin}/push/${++this.next}`;
    this.keys.set(endpoint, { ecdh, auth });
    return {
      endpoint,
      keys: { p256dh: ecdh.getPublicKey('base64url'), auth: auth.toString('base64url') },
    };
  }

  /** Les prochaines réponses de cet endpoint, dans l'ordre ; 201 ensuite. */
  respondWith(endpoint: string, ...statuses: number[]): void {
    this.statuses.set(endpoint, statuses);
  }

  /** Retient les réponses ; la fonction rendue les relâche. */
  hold(): () => void {
    let release!: () => void;
    this.held = new Promise((resolve) => (release = resolve));
    return () => {
      this.held = null;
      release();
    };
  }

  /** Attend que `count` requêtes au moins soient arrivées, et les rend. */
  async receivedAtLeast(count: number): Promise<ReceivedPush[]> {
    while (this.received.length < count) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`${this.received.length} envois reçus sur ${count} attendus.`)),
          5000,
        );
        this.waiters.push(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    return this.received;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
