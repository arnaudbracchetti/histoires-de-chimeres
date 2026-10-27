// PROTOTYPE (#59). Identité du téléphone, journal remonté au serveur, et observation de
// l'arrière-plan (minuterie, visibilité, flux SSE), lancés dès l'ouverture, quelle que soit la page.
import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';

declare global {
  interface Window {
    laboBoot: { href: string; referrer: string; at: number };
    laboInstall: { event: InstallPromptEvent | null; firedAt: number[]; installedAt: number | null };
    pushManager?: PushManager;
  }
}

// `beforeinstallprompt` (Chromium seulement), absent des types du DOM.
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface Entry {
  at: number;
  text: string;
}

export interface FirstOpening {
  href: string;
  at: number;
  context: string;
}

export async function api<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive: true,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

export function time(at: number | undefined): string {
  if (!at) return '—';
  return new Date(at).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });
}

export function dateTime(at: number): string {
  return new Date(at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

const seconds = (ms: number) => `${Math.round(ms / 1000)} s`;

const DISPLAY_MODES = ['browser', 'minimal-ui', 'standalone', 'fullscreen'];

// Valeurs de `display-mode` vraies pour cette page : la seule façon, sur Android, de savoir
// qu'elle tourne dans l'application installée (#61).
export function displayModes(): string {
  return DISPLAY_MODES.filter((mode) => matchMedia(`(display-mode: ${mode})`).matches).join(', ') || 'aucune';
}

@Injectable({ providedIn: 'root' })
export class Lab {
  private readonly swPush = inject(SwPush);

  readonly boot = window.laboBoot;
  readonly standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  readonly context = this.standalone ? 'web app' : 'navigateur';
  readonly phoneId: string;
  readonly createdHere: boolean;
  readonly firstOpening: FirstOpening;
  readonly name = signal(read('labo-nom') ?? '');
  readonly entries = signal<Entry[]>([]);
  readonly stream = signal('fermé');
  readonly subscription = signal<PushSubscription | null>(null);

  private pending: Entry[] = [];
  private lastTick = Date.now();
  private hiddenAt = 0;
  private lastStreamMessage = 0;

  constructor() {
    const id = read('labo-telephone');
    this.createdHere = !id;
    this.phoneId = id ?? crypto.randomUUID().slice(0, 8);
    write('labo-telephone', this.phoneId);
    const first = read('labo-premiere-ouverture');
    this.firstOpening = first
      ? (JSON.parse(first) as FirstOpening)
      : { href: this.boot.href, at: this.boot.at, context: this.context };
    write('labo-premiere-ouverture', JSON.stringify(this.firstOpening));

    void this.hello();
    this.log(
      `Ouverture (${this.context}, display-mode ${displayModes()}) : ${this.boot.href}${this.createdHere ? ' — stockage local vide' : ''}`,
    );
    this.watchBackground();
    this.openStream();
    void this.resendSubscription();

    this.swPush.messages.subscribe((message) => {
      const n = (message as { notification?: { data?: { n?: number } } }).notification?.data?.n;
      this.log(`Push reçu page ouverte (SwPush.messages) : n°${n}`);
    });
    this.swPush.notificationClicks.subscribe(({ notification }) =>
      this.log(`Clic vu par la page (SwPush.notificationClicks) : n°${(notification.data as { n?: number })?.n}`),
    );
    window.laboInstall.firedAt.forEach((at, k) => this.log(`beforeinstallprompt n°${k + 1} reçu avant Angular, ${this.sinceBoot(at)}`));
    addEventListener('labo-installable', () => {
      const fired = window.laboInstall.firedAt;
      this.log(`beforeinstallprompt n°${fired.length} reçu, ${this.sinceBoot(fired[fired.length - 1])}`);
    });
    addEventListener('appinstalled', () => this.log(`appinstalled : application installée, ${this.sinceBoot(Date.now())}`));
    for (const mode of DISPLAY_MODES) {
      matchMedia(`(display-mode: ${mode})`).addEventListener('change', (event) => {
        if (event.matches) this.log(`display-mode devient ${mode}`);
      });
    }
    addEventListener('online', () => this.log('Réseau : en ligne'));
    addEventListener('offline', () => this.log('Réseau : hors ligne'));
    addEventListener('popstate', () => this.log(`Retour (popstate) : ${location.pathname}, history.length ${history.length}`));
    setInterval(() => void this.flush(), 10_000);
  }

  rename(name: string) {
    this.name.set(name);
    write('labo-nom', name);
    void this.hello();
  }

  sinceBoot(at: number): string {
    return `${((at - this.boot.at) / 1000).toFixed(1).replace('.', ',')} s après l’ouverture`;
  }

  log(text: string) {
    const entry = { at: Date.now(), text };
    this.entries.update((list) => [entry, ...list].slice(0, 300));
    this.pending.push(entry);
    void this.flush();
  }

  async registration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000));
    return Promise.race([navigator.serviceWorker.ready, timeout]);
  }

  async sendSubscription(subscription: PushSubscription, via: string) {
    this.subscription.set(subscription);
    const { change } = await api<{ change: string }>('POST', '/api/abonnements', {
      phoneId: this.phoneId,
      subscription: subscription.toJSON(),
      via,
    });
    this.log(`Abonnement envoyé (${via}) : ${new URL(subscription.endpoint).host}, ${change}`);
  }

  private async hello() {
    try {
      await api('POST', '/api/telephones', {
        phoneId: this.phoneId,
        name: this.name(),
        context: this.context,
        userAgent: navigator.userAgent,
        href: this.boot.href,
      });
    } catch {}
  }

  private async flush() {
    if (!this.pending.length) return;
    const batch = this.pending;
    this.pending = [];
    try {
      await api('POST', '/api/journal', { phoneId: this.phoneId, entries: batch });
    } catch {
      this.pending = [...batch, ...this.pending];
    }
  }

  // L'abonnement est renvoyé à chaque ouverture : Safari iOS ne signale pas son renouvellement.
  private async resendSubscription() {
    try {
      const registration = await this.registration();
      const subscription =
        (await registration?.pushManager.getSubscription()) ?? (await window.pushManager?.getSubscription()) ?? null;
      if (subscription) await this.sendSubscription(subscription, 'renvoi à l’ouverture');
      else this.log(`Aucun abonnement à renvoyer${registration ? '' : ' (pas de service worker prêt)'}`);
    } catch (error) {
      this.log(`Renvoi de l’abonnement : ${error}`);
    }
  }

  private watchBackground() {
    setInterval(() => {
      const now = Date.now();
      if (now - this.lastTick > 3000) this.log(`Minuterie : ${seconds(now - this.lastTick)} sans tick`);
      this.lastTick = now;
    }, 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.hiddenAt = Date.now();
        this.log('Passe en arrière-plan');
      } else {
        this.log(`Revient au premier plan après ${seconds(Date.now() - this.hiddenAt)}`);
      }
    });
    addEventListener('pagehide', (event) => this.log(`pagehide (persisted ${event.persisted})`));
    addEventListener('pageshow', (event) => {
      if (event.persisted) this.log('pageshow depuis le cache arrière/avant');
    });
    document.addEventListener('freeze', () => this.log('freeze'));
    document.addEventListener('resume', () => this.log('resume'));
  }

  private openStream() {
    const source = new EventSource(`/api/flux?telephone=${this.phoneId}`);
    source.onopen = () => {
      const gap = this.lastStreamMessage ? `, dernier message il y a ${seconds(Date.now() - this.lastStreamMessage)}` : '';
      this.stream.set(`ouvert à ${time(Date.now())}`);
      this.log(`Flux SSE ouvert${gap}`);
    };
    source.onmessage = () => {
      this.lastStreamMessage = Date.now();
      this.stream.set(`dernier message à ${time(this.lastStreamMessage)}`);
    };
    source.onerror = () => {
      this.stream.set(`coupé à ${time(Date.now())} (readyState ${source.readyState})`);
      this.log(`Flux SSE coupé (readyState ${source.readyState})`);
    };
  }
}
