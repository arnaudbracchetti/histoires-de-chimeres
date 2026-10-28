import { Component, inject, OnInit, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { api, dateTime, displayModes, Lab, time, urlBase64ToUint8Array } from './lab';

interface CookieValue {
  by: string;
  name: string;
  context: string;
  at: number;
}

const codeOf = (href: string) => new URL(href).searchParams.get('code') ?? 'aucun';

// Écran unique du téléphone : chaque section répond à une vérification de #53.
@Component({
  imports: [RouterLink],
  template: `
    <h1>Labo Chimères</h1>
    <p class="muted">Prototype jetable (#59). Tout ce qui se passe ici remonte au pilotage.</p>

    <section>
      <h2>Ce téléphone</h2>
      <label>
        Nom
        <input [value]="lab.name()" (change)="lab.rename($any($event.target).value)" placeholder="iPhone 15 d'Arnaud" />
      </label>
      <dl>
        <dt>Contexte</dt>
        <dd>{{ lab.context }}</dd>
        <dt>Identifiant</dt>
        <dd>{{ lab.phoneId }}{{ lab.createdHere ? ' (créé à cette ouverture)' : '' }}</dd>
        <dt>Agent</dt>
        <dd>{{ userAgent }}</dd>
        <dt>Manifeste</dt>
        <dd>{{ manifest }}</dd>
      </dl>
    </section>

    <section>
      <h2>Ouverture et code de présence</h2>
      <dl>
        <dt>Cette ouverture</dt>
        <dd>{{ lab.boot.href }}</dd>
        <dt>Code lu</dt>
        <dd>{{ codeOf(lab.boot.href) }}</dd>
        <dt>Référent</dt>
        <dd>{{ lab.boot.referrer || '—' }}</dd>
        <dt>1re ouverture</dt>
        <dd>{{ lab.firstOpening.href }} ({{ lab.firstOpening.context }}, {{ dateTime(lab.firstOpening.at) }})</dd>
        <dt>Code à la 1re</dt>
        <dd>{{ codeOf(lab.firstOpening.href) }}</dd>
      </dl>
    </section>

    <section>
      <h2>Installation</h2>
      <p>{{ installState() }}</p>
      <dl>
        <dt>display-mode</dt>
        <dd>{{ displayModes }}</dd>
        <dt>beforeinstallprompt</dt>
        <dd>{{ prompts() }}</dd>
        <dt>appinstalled</dt>
        <dd>{{ installed() }}</dd>
        <dt>Applis liées</dt>
        <dd>{{ relatedApps() }}</dd>
      </dl>
      @if (installable()) {
        <button class="primary" (click)="install()">Installer</button>
      }
      <button (click)="checkRelatedApps()">Revérifier les applis liées</button>
    </section>

    <section>
      <h2>Passer dans l'application</h2>
      <p>Depuis Chrome, l'application installée : chaque lien ouvre l'accueil du labo avec
        <code>?ouvert-par=…</code>. Regarde où il s'ouvre (onglet de Chrome ou application) et le contexte
        de « Ce téléphone ».</p>
      <a class="button" href="/?ouvert-par=lien" (click)="lab.log('Passer dans l’application : lien, même onglet')">Lien, même onglet</a>
      <a class="button" href="/?ouvert-par=nouvel-onglet" target="_blank" (click)="lab.log('Passer dans l’application : lien, nouvel onglet')">Lien, nouvel onglet</a>
      <a class="button" [href]="intentUrl" (click)="lab.log('Passer dans l’application : intent://')">intent://</a>
    </section>

    <section>
      <h2>Cookie HttpOnly</h2>
      <p>Pose-le dans le navigateur, puis ouvre la web app de l'écran d'accueil : le serveur dit s'il le reçoit.</p>
      <p [class]="cookie() ? 'ok' : 'ko'">
        @if (cookie(); as c) {
          Reçu : posé par {{ c.name || c.by }} ({{ c.context }}) le {{ dateTime(c.at) }}
        } @else {
          Aucun cookie reçu par le serveur
        }
      </p>
      <button class="primary" (click)="setCookie()">Poser le cookie</button>
      <button (click)="readCookie()">Relire</button>
      <button (click)="clearCookie()">Effacer</button>
    </section>

    <section>
      <h2>Notifications</h2>
      <dl>
        <dt>Notification</dt>
        <dd>{{ support.notification }}</dd>
        <dt>Permission</dt>
        <dd>{{ permission() }}</dd>
        <dt>PushManager</dt>
        <dd>{{ support.pushManager }}</dd>
        <dt>window.pushManager</dt>
        <dd>{{ support.declarative }}</dd>
        <dt>SwPush.isEnabled</dt>
        <dd>{{ swPush.isEnabled }}</dd>
        <dt>Worker</dt>
        <dd>{{ worker() }}</dd>
        <dt>Abonnement</dt>
        <dd>{{ subscriptionText() }}</dd>
      </dl>
      @if (!publicKey()) {
        <p class="ko">Le serveur n'a pas de clés VAPID.</p>
      }
      <button class="primary" (click)="subscribeSwPush()">S'abonner (SwPush)</button>
      <button (click)="subscribeWorker()">S'abonner (pushManager du worker)</button>
      @if (support.declarative === 'oui') {
        <button (click)="subscribeWindow()">S'abonner (window.pushManager)</button>
      }
      <button (click)="askPermission()">Permission seule</button>
      <button (click)="unsubscribe()">Se désabonner</button>
      <label>
        <input type="checkbox" [checked]="lab.autoSubscribe()" (change)="lab.setAutoSubscribe($any($event.target).checked)" />
        S'abonner seul, sans tap, à l'ouverture et au retour au premier plan
      </label>
    </section>

    <section>
      <h2>Retour et hors ligne</h2>
      <button (click)="go('/ecran/1')">Empiler des écrans</button>
      <button (click)="go('/hors-ligne')">Programme hors ligne</button>
    </section>

    <section>
      <h2>Arrière-plan</h2>
      <p>Mets l'app en arrière-plan ou verrouille le téléphone, attends, reviens : le journal note les trous
        de la minuterie et les coupures du flux.</p>
      <dl>
        <dt>Flux SSE</dt>
        <dd>{{ lab.stream() }}</dd>
      </dl>
    </section>

    <section>
      <h2>Journal</h2>
      <pre class="journal">@for (entry of lab.entries(); track entry) {{{ time(entry.at) }} {{ entry.text }}
}</pre>
    </section>

    <p class="muted"><a routerLink="/pilotage">Pilotage</a> (sur ordinateur)</p>
  `,
})
export class Phone implements OnInit {
  protected readonly lab = inject(Lab);
  protected readonly swPush = inject(SwPush);
  private readonly router = inject(Router);
  protected readonly time = time;
  protected readonly dateTime = dateTime;
  protected readonly codeOf = codeOf;
  protected readonly userAgent = navigator.userAgent;
  protected readonly manifest = (document.getElementById('manifeste') as HTMLLinkElement).getAttribute('href');
  protected readonly support = {
    notification: 'Notification' in window ? 'oui' : 'non',
    pushManager: 'PushManager' in window ? 'oui' : 'non',
    declarative: 'pushManager' in window ? 'oui' : 'non',
  };
  protected readonly permission = signal('Notification' in window ? Notification.permission : 'absente');
  protected readonly worker = signal('…');
  protected readonly cookie = signal<CookieValue | null>(null);
  protected readonly publicKey = signal<string | null>(null);

  protected readonly installable = signal(!!window.laboInstall.event);
  protected readonly installState = signal(this.describeInstall());
  protected readonly displayModes = displayModes();
  protected readonly prompts = signal(this.describePrompts());
  protected readonly installed = signal(this.describeInstalled());
  protected readonly relatedApps = signal('…');
  // `intent:` passe par l'Android de Chrome, qui peut le confier à l'application installée. Le repli
  // (`browser_fallback_url`) ne sert que si aucune application ne le prend. Angular refuse ce schéma sans
  // `bypassSecurityTrustUrl`.
  protected readonly intentUrl = inject(DomSanitizer).bypassSecurityTrustUrl(
    `intent://${location.host}/?ouvert-par=intent#Intent;scheme=https;` +
      `S.browser_fallback_url=${encodeURIComponent(`${location.origin}/?ouvert-par=intent-repli`)};end`,
  );

  private describeInstall(): string {
    if (this.lab.standalone) return 'Ouverte depuis l’écran d’accueil : déjà installée.';
    if (window.laboInstall.event) return 'Installable : le bouton « Installer » ouvre la fenêtre de Chrome.';
    if (!('onbeforeinstallprompt' in window)) return 'Ce navigateur ne propose pas beforeinstallprompt (Safari, Firefox).';
    return 'Pas de beforeinstallprompt en attente : l’app est peut-être déjà installée, ou le navigateur attend.';
  }

  private describePrompts(): string {
    const fired = window.laboInstall.firedAt;
    if (!fired.length) return 'aucun';
    return fired.map((at, k) => `n°${k + 1} à ${time(at)} (${this.lab.sinceBoot(at)})`).join(' ; ');
  }

  private describeInstalled(): string {
    const at = window.laboInstall.installedAt;
    return at ? `reçu à ${time(at)} (${this.lab.sinceBoot(at)})` : 'pas reçu';
  }

  async install() {
    const event = window.laboInstall.event!;
    this.lab.log('Installer : prompt()');
    await event.prompt();
    const choice = await event.userChoice;
    this.lab.log(`Installer : ${choice.outcome} (${choice.platform || '?'})`);
    // Un événement ne sert qu'une fois.
    window.laboInstall.event = null;
    this.installable.set(false);
    this.installState.set(choice.outcome === 'accepted' ? 'Installation acceptée.' : 'Installation refusée.');
  }

  // Avec `related_applications` (manifeste A), Chrome sur Android dit si l'application est installée,
  // même à la page restée dans Chrome.
  async checkRelatedApps() {
    const nav = navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<{ platform: string; url?: string; id?: string }[]>;
    };
    if (!nav.getInstalledRelatedApps) {
      this.relatedApps.set('getInstalledRelatedApps absent');
    } else {
      try {
        const apps = await nav.getInstalledRelatedApps();
        this.relatedApps.set(apps.length ? apps.map((a) => `${a.platform} ${a.url ?? a.id ?? ''}`).join(' ; ') : 'aucune');
      } catch (error) {
        this.relatedApps.set(`erreur : ${error}`);
      }
    }
    this.lab.log(`getInstalledRelatedApps : ${this.relatedApps()}`);
  }

  async ngOnInit() {
    addEventListener('labo-installable', () => {
      this.installable.set(true);
      this.installState.set(this.describeInstall());
      this.prompts.set(this.describePrompts());
    });
    addEventListener('appinstalled', () => this.installed.set(this.describeInstalled()));
    void this.checkRelatedApps();
    void this.readCookie();
    const registration = await this.lab.registration();
    this.worker.set(
      registration
        ? `${registration.active?.state ?? 'pas actif'}, ${navigator.serviceWorker.controller ? 'contrôle la page' : 'ne contrôle pas la page'}`
        : 'aucun',
    );
    const { publicKey } = await api<{ publicKey: string | null }>('GET', '/api/cle-publique');
    this.publicKey.set(publicKey);
  }

  protected subscriptionText() {
    const subscription = this.lab.subscription();
    return subscription ? `${new URL(subscription.endpoint).host} …${subscription.endpoint.slice(-8)}` : 'aucun';
  }

  // Navigation du routeur : pushState.
  protected go(path: string) {
    void this.router.navigateByUrl(path);
  }

  async setCookie() {
    const { value } = await api<{ value: CookieValue }>('POST', '/api/cookie', {
      phoneId: this.lab.phoneId,
      context: this.lab.context,
    });
    this.lab.log(`Cookie posé (${value.context})`);
    await this.readCookie();
  }

  async readCookie() {
    const { value } = await api<{ value: CookieValue | null }>('GET', `/api/cookie?telephone=${this.lab.phoneId}`);
    this.cookie.set(value);
  }

  async clearCookie() {
    await api('DELETE', `/api/cookie?telephone=${this.lab.phoneId}`);
    await this.readCookie();
  }

  async askPermission() {
    const result = await Notification.requestPermission();
    this.permission.set(result);
    this.lab.log(`Permission : ${result}`);
  }

  // Trois chemins, pour voir lequel garde le geste de l'utilisateur sur Safari iOS.
  async subscribeSwPush() {
    await this.subscribe('SwPush', () => this.swPush.requestSubscription({ serverPublicKey: this.publicKey()! }));
  }

  async subscribeWorker() {
    await this.subscribe('pushManager du worker', async () => {
      const registration = await this.lab.registration();
      if (!registration) throw new Error('pas de service worker prêt');
      return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(this.publicKey()!),
      });
    });
  }

  async subscribeWindow() {
    await this.subscribe('window.pushManager', () =>
      window.pushManager!.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(this.publicKey()!) }),
    );
  }

  async unsubscribe() {
    const subscription = this.lab.subscription();
    await subscription?.unsubscribe();
    this.lab.subscription.set(null);
    await api('DELETE', `/api/abonnements?telephone=${this.lab.phoneId}`);
    this.lab.log('Désabonné');
  }

  private async subscribe(via: string, subscribe: () => Promise<PushSubscription>) {
    this.lab.log(`Abonnement demandé (${via})`);
    try {
      const subscription = await subscribe();
      this.permission.set(Notification.permission);
      await this.lab.sendSubscription(subscription, via);
    } catch (error) {
      this.permission.set('Notification' in window ? Notification.permission : 'absente');
      this.lab.log(`Abonnement refusé (${via}) : ${error}`);
    }
  }
}
