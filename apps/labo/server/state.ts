// PROTOTYPE (#59). Tout vit en mémoire, recopié toutes les 5 s dans le fichier LABO_DATA
// (un volume Docker en production) : un redéploiement garde téléphones, journaux, envois et constats.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import webpush, { type PushSubscription } from 'web-push';

export interface Entry {
  at: number;
  text: string;
  from: 'téléphone' | 'serveur';
}

export interface PhoneState {
  id: string;
  name: string;
  context: string;
  userAgent: string;
  firstSeen: number;
  lastSeen: number;
  subscription?: PushSubscription;
  subscriptionVia?: string;
  subscriptionAt?: number;
  journal: Entry[];
}

export interface SendRequest {
  phoneIds: string[];
  title: string;
  body: string;
  format: 'double' | 'angular' | 'declaratif';
  mutable: boolean;
  tag: string;
  topic: string;
  urgency: 'very-low' | 'low' | 'normal' | 'high';
  ttl: number;
  delaySeconds: number;
  repeat: number;
  intervalSeconds: number;
}

export interface SendState {
  n: number;
  phoneId: string;
  phoneName: string;
  title: string;
  body: string;
  format: string;
  urgency: string;
  ttl: number;
  tag: string;
  topic: string;
  scheduledAt: number;
  sentAt?: number;
  status?: number;
  ms?: number;
  response?: string;
  receivedAt?: number;
  receivedSource?: string;
  clickedAt?: number;
  via?: string;
}

// Grille des constats de #53 : les vérifications sont listées par le pilotage, les cases
// sont rangées par `${vérification}|${appareil}`.
export interface Findings {
  devices: { id: string; label: string }[];
  cells: Record<string, { verdict: string; note: string }>;
}

export const phones = new Map<string, PhoneState>();
export const sends: SendState[] = [];
export const findings: Findings = { devices: [], cells: {} };
let lastN = 0;

const dataFile = process.env['LABO_DATA'];

if (dataFile && existsSync(dataFile)) {
  const saved = JSON.parse(readFileSync(dataFile, 'utf8')) as {
    phones: PhoneState[];
    sends: SendState[];
    findings: Findings;
    lastN: number;
  };
  for (const p of saved.phones) phones.set(p.id, p);
  sends.push(...saved.sends);
  Object.assign(findings, saved.findings);
  lastN = saved.lastN;
}

export function save() {
  if (!dataFile) return;
  writeFileSync(`${dataFile}.tmp`, JSON.stringify({ phones: [...phones.values()], sends, findings, lastN }));
  renameSync(`${dataFile}.tmp`, dataFile);
}

setInterval(save, 5000);

const vapid = {
  subject: process.env['VAPID_SUBJECT'] ?? 'https://test.nekbet.fr',
  publicKey: process.env['VAPID_PUBLIC_KEY'] ?? '',
  privateKey: process.env['VAPID_PRIVATE_KEY'] ?? '',
};

export const publicKey = vapid.publicKey;
export const origin = process.env['LABO_ORIGINE'] ?? 'http://localhost:4210';

export function phone(id: string): PhoneState {
  let found = phones.get(id);
  if (!found) {
    found = {
      id,
      name: '',
      context: '',
      userAgent: '',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      journal: [],
    };
    phones.set(id, found);
  }
  found.lastSeen = Date.now();
  return found;
}

export function note(phoneState: PhoneState, text: string, from: Entry['from'] = 'serveur', at = Date.now()) {
  phoneState.journal.push({ at, text, from });
  if (phoneState.journal.length > 500) phoneState.journal.shift();
}

export function phoneByEndpoint(endpoint: string | undefined): PhoneState | undefined {
  return [...phones.values()].find((p) => p.subscription?.endpoint === endpoint);
}

export function pushHost(endpoint: string | undefined): string {
  return endpoint ? new URL(endpoint).host : 'aucun';
}

// Un en-tête VAPID par service push, gardé une heure (Apple demande d'en signer au plus un
// par heure), valable 12 h : comme le prévoit l'ADR 0010.
const vapidByAudience = new Map<string, { headers: Record<string, string>; until: number }>();

function vapidHeaders(endpoint: string): Record<string, string> {
  const audience = new URL(endpoint).origin;
  const cached = vapidByAudience.get(audience);
  if (cached && cached.until > Date.now()) return cached.headers;
  const headers = webpush.getVapidHeaders(
    audience,
    vapid.subject,
    vapid.publicKey,
    vapid.privateKey,
    'aes128gcm',
    Math.floor(Date.now() / 1000) + 12 * 3600,
  ) as unknown as Record<string, string>;
  vapidByAudience.set(audience, { headers, until: Date.now() + 3600 * 1000 });
  return headers;
}

// Un seul JSON pour les deux formats (ADR 0010) : déclaratif (`web_push`, `navigate`) pour
// Safari 18.4 et plus, `data.onActionClick` pour le service worker d'Angular.
function payload(send: SendState, request: SendRequest): string {
  const notification: Record<string, unknown> = {
    title: send.title,
    body: send.body,
    lang: 'fr',
    icon: `${origin}/icons/icon-192.png`,
    data: { n: send.n } as Record<string, unknown>,
  };
  if (request.tag) notification['tag'] = request.tag;
  const message: Record<string, unknown> = { notification };
  if (request.format !== 'declaratif') {
    (notification['data'] as Record<string, unknown>)['onActionClick'] = {
      default: { operation: 'navigateLastFocusedOrOpen', url: `/arrivee?n=${send.n}&via=onActionClick` },
    };
  }
  if (request.format !== 'angular') {
    message['web_push'] = 8030;
    notification['navigate'] = `${origin}/arrivee?n=${send.n}&via=navigate`;
    if (request.mutable) message['mutable'] = true;
  }
  return JSON.stringify(message);
}

async function deliver(send: SendState, request: SendRequest) {
  const target = phones.get(send.phoneId);
  const subscription = target?.subscription;
  send.sentAt = Date.now();
  if (!target || !subscription) {
    send.response = 'pas d’abonnement';
    return;
  }
  try {
    const details = webpush.generateRequestDetails(subscription, payload(send, request), {
      TTL: request.ttl,
      urgency: request.urgency,
      ...(request.topic ? { topic: request.topic } : {}),
      headers: vapidHeaders(subscription.endpoint),
    });
    const headers = { ...details.headers } as Record<string, string>;
    delete headers['Content-Length'];
    const response = await fetch(details.endpoint, {
      method: 'POST',
      headers,
      body: details.body as unknown as Uint8Array<ArrayBuffer>,
      signal: AbortSignal.timeout(10_000),
    });
    send.status = response.status;
    send.ms = Date.now() - send.sentAt;
    send.response = (await response.text()).slice(0, 300);
    note(target, `Envoi n°${send.n} « ${send.title} » : HTTP ${send.status} en ${send.ms} ms`);
    if (response.status === 404 || response.status === 410) {
      target.subscription = undefined;
      note(target, `Abonnement effacé (HTTP ${response.status})`);
    }
  } catch (error) {
    send.response = String(error);
    note(target, `Envoi n°${send.n} : erreur ${send.response}`);
  }
}

export function schedule(request: SendRequest) {
  const created: SendState[] = [];
  for (let k = 0; k < request.repeat; k++) {
    for (const phoneId of request.phoneIds) {
      const target = phones.get(phoneId);
      const suffix = request.repeat > 1 ? ` (${k + 1}/${request.repeat})` : '';
      const send: SendState = {
        n: ++lastN,
        phoneId,
        phoneName: target ? `${target.name || 'sans nom'} · ${target.context}` : phoneId,
        title: request.title,
        body: request.body + suffix,
        format: request.format + (request.mutable ? ' + mutable' : ''),
        urgency: request.urgency,
        ttl: request.ttl,
        tag: request.tag,
        topic: request.topic,
        scheduledAt: Date.now() + (request.delaySeconds + k * request.intervalSeconds) * 1000,
      };
      sends.unshift(send);
      created.push(send);
      setTimeout(() => void deliver(send, request), send.scheduledAt - Date.now());
    }
  }
  sends.splice(300);
  return created;
}
