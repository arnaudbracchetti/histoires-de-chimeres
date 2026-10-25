import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api, dateTime, time } from './lab';

interface PhoneView {
  id: string;
  name: string;
  context: string;
  userAgent: string;
  lastSeen: number;
  hasSubscription: boolean;
  subscriptionVia?: string;
  subscriptionAt?: number;
  pushHost: string;
  journal: { at: number; text: string; from: string }[];
}

interface SendView {
  n: number;
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

interface Template {
  label: string;
  title: string;
  body: string;
  replaces?: boolean;
}

// Textes de NO-2 (docs/prd.md §5.6), avec des titres de partie longs pour voir où ils se coupent.
const TEMPLATES: Template[] = [
  {
    label: 'Nouvelle partie',
    title: 'Créneau 2 : nouvelle partie',
    body: 'La Tour des Mille Soupirs · L’Appel de Cthulhu, table 7. Tu peux t’y inscrire.',
    replaces: true,
  },
  {
    label: 'Nouvelle partie, inscriptions rouvertes',
    title: 'Créneau 2 : nouvelle partie',
    body: 'Sang d’encre à Port-Vesper · Blades in the Dark, table 12. Tu peux t’y inscrire. Les inscriptions du créneau sont rouvertes.',
    replaces: true,
  },
  {
    label: 'Tu mènes une partie (MJ)',
    title: 'Créneau 2 : tu mènes une partie',
    body: 'Les Brumes d’Avalon, table 4, 14 h 00 – 18 h 00. Tes inscriptions sur ce créneau sont retirées.',
  },
  {
    label: 'Partie retirée (inscrits)',
    title: 'Créneau 3 : partie retirée du programme',
    body: 'Les Brumes d’Avalon est retirée : ton inscription est supprimée.',
  },
  {
    label: 'Partie retirée (MJ)',
    title: 'Créneau 3 : partie retirée du programme',
    body: 'Les Brumes d’Avalon est retirée : tu peux t’inscrire sur ce créneau.',
  },
  {
    label: 'Partie déplacée',
    title: 'Créneau 2 : partie déplacée',
    body: 'La Tour des Mille Soupirs passe au créneau 4 : ton inscription est retirée. Réinscris-toi si l’horaire te va.',
  },
  {
    label: 'Publication, affecté',
    title: 'Créneau 2 : table 12',
    body: 'Tu joues à Sang d’encre à Port-Vesper, avec Mordecai.',
  },
  {
    label: 'Publication, affecté, partie double',
    title: 'Créneaux 12 et 13 : table 12',
    body: 'Tu joues à La Tour des Mille Soupirs, avec Mordecai.',
  },
  {
    label: 'Publication, non placé',
    title: 'Créneau 2 : pas de place pour toi',
    body: 'Les parties que tu avais choisies sont complètes. Il reste de la place aux tables 3 et 11 : va voir leur MJ.',
  },
  {
    label: 'Publication, MJ',
    title: 'Créneau 2 : tu mènes à la table 4',
    body: 'Les Brumes d’Avalon, avec 5 joueurs.',
  },
  {
    label: 'Publication, partie annulée',
    title: 'Créneau 2 : ta partie est annulée',
    body: 'Les Brumes d’Avalon n’a pas atteint son minimum. Il reste de la place aux tables 3 et 11 : va voir leur MJ.',
  },
  {
    label: 'Titre le plus long',
    title: 'Créneaux 12 et 13 : partie retirée du programme',
    body: 'La Tour des Mille Soupirs est retirée : ton inscription est supprimée.',
  },
];

interface Findings {
  devices: { id: string; label: string }[];
  cells: Record<string, { verdict: string; note: string }>;
}

// Vérifications de #53, dans l'ordre du déroulé du README.
const CHECKS = [
  { id: 'installer', label: 'Bouton « Installer » (beforeinstallprompt) : proposé, et combien de taps' },
  { id: 'cookie', label: 'Cookie posé dans le navigateur, reçu dans la web app' },
  { id: 'code-a', label: 'Code du QR lu à la 1re ouverture de la web app (manifeste A, start_url)' },
  { id: 'code-b', label: 'Code du QR lu à la 1re ouverture de la web app (manifeste B, sans start_url)' },
  { id: 'lien', label: 'Un lien vers le site ouvre l’app installée' },
  { id: 'abonnement', label: 'Abonnement après un tap (quel chemin marche)' },
  { id: 'push-ferme', label: 'Push reçu, app fermée ; délai avec Urgency: high' },
  { id: 'tap-ferme', label: 'Tap, app fermée : page ouverte et chemin (navigate / onActionClick)' },
  { id: 'tap-ouvert', label: 'Tap, app au premier plan : page ouverte et chemin' },
  { id: 'banniere', label: 'Bannière affichée app au premier plan (NO-5)' },
  { id: 'titre', label: 'Titre : où il se coupe (écran verrouillé, centre de notifications)' },
  { id: 'tag', label: 'Deux « nouvelle partie » en ligne : la 2e remplace la 1re, sans son (tag)' },
  { id: 'topic', label: 'Deux « nouvelle partie » hors ligne : seule la dernière arrive (Topic)' },
  { id: 'retour', label: 'Retour : bouton d’Android, geste du bord sur iPhone' },
  { id: 'minuterie', label: 'Minuterie en arrière-plan' },
  { id: 'flux', label: 'Flux SSE en arrière-plan' },
  { id: 'cache', label: 'Programme lu sans réseau, app rouverte' },
];

const KEY_STORAGE = 'labo-cle';

// Écran de pilotage, sur ordinateur : il déclenche chaque envoi et montre ce que les téléphones rapportent.
@Component({
  imports: [FormsModule],
  styles: `
    :host {
      display: block;
      max-width: 1200px;
      margin: 0 auto;
    }
    .columns {
      display: grid;
      grid-template-columns: minmax(320px, 1fr) 2fr;
      gap: 12px;
      align-items: start;
    }
    label {
      display: block;
      margin: 6px 0;
    }
    textarea,
    input[type='text'],
    select {
      width: 100%;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 0.8rem;
    }
    td,
    th {
      border-bottom: 1px solid var(--border);
      padding: 4px;
      text-align: left;
      vertical-align: top;
    }
    .qr {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .qr img {
      background: white;
      width: 200px;
    }
  `,
  template: `
    <h1>Pilotage du labo</h1>
    <section>
      <label>Clé de pilotage <input type="text" [ngModel]="key()" (ngModelChange)="saveKey($event)" /></label>
      @if (error()) {
        <p class="ko">{{ error() }}</p>
      }
    </section>

    <section>
      <h2>QR codes</h2>
      <div class="qr">
        @for (link of links; track link.url) {
          <figure>
            <img [src]="'/api/qr.svg?url=' + encode(link.url)" [alt]="link.url" />
            <figcaption class="muted">{{ link.label }}<br />{{ link.url }}</figcaption>
          </figure>
        }
      </div>
    </section>

    <section>
      <h2>Constats</h2>
      <p class="muted">Un appareil par colonne (modèle, OS et version, navigateur). Chaque changement est enregistré.</p>
      <label>Ajouter un appareil <input type="text" #device placeholder="iPhone 15, iOS 26.0.1" (keyup.enter)="addDevice(device.value); device.value = ''" /></label>
      @if (findings(); as f) {
        <div style="overflow-x: auto">
          <table>
            <tr>
              <th>Vérification</th>
              @for (d of f.devices; track d.id) {
                <th>{{ d.label }} <button (click)="removeDevice(d.id)" title="Retirer">×</button></th>
              }
            </tr>
            @for (c of checks; track c.id) {
              <tr>
                <td>{{ c.label }}</td>
                @for (d of f.devices; track d.id) {
                  <td>
                    <select [ngModel]="cell(c.id, d.id).verdict" (ngModelChange)="setCell(c.id, d.id, 'verdict', $event)">
                      <option value="">—</option>
                      <option value="vu">vu</option>
                      <option value="pas vu">pas vu</option>
                      <option value="partiel">partiel</option>
                    </select>
                    <textarea rows="2" [ngModel]="cell(c.id, d.id).note" (change)="setCell(c.id, d.id, 'note', $any($event.target).value)"></textarea>
                  </td>
                }
              </tr>
            }
          </table>
        </div>
      }
      <button class="primary" (click)="copyMarkdown()">Copier en Markdown</button>
      @if (copied()) {
        <span class="ok">{{ copied() }}</span>
      }
    </section>

    <div class="columns">
      <section>
        <h2>Envoi</h2>
        <label>
          Modèle
          <select [ngModel]="templateIndex()" (ngModelChange)="pick($event)">
            @for (t of templates; track t.label; let i = $index) {
              <option [ngValue]="i">{{ t.label }}</option>
            }
          </select>
        </label>
        <label>Titre ({{ form.title.length }} car.) <input type="text" [(ngModel)]="form.title" /></label>
        <label>Corps ({{ form.body.length }} car.) <textarea rows="3" [(ngModel)]="form.body"></textarea></label>
        <label>
          Format
          <select [(ngModel)]="form.format">
            <option value="double">Double : déclaratif + onActionClick</option>
            <option value="angular">onActionClick seul (Angular)</option>
            <option value="declaratif">Déclaratif seul</option>
          </select>
        </label>
        <label><input type="checkbox" [(ngModel)]="form.mutable" /> mutable (le worker voit le message déclaratif)</label>
        <label>tag <input type="text" [(ngModel)]="form.tag" placeholder="vide : aucun" /></label>
        <label>Topic (32 car. base64url) <input type="text" [(ngModel)]="form.topic" placeholder="vide : aucun" /></label>
        <label>
          Urgency
          <select [(ngModel)]="form.urgency">
            <option value="high">high</option>
            <option value="normal">normal</option>
            <option value="low">low</option>
            <option value="very-low">very-low</option>
          </select>
        </label>
        <label>TTL (s) <input type="number" [(ngModel)]="form.ttl" /></label>
        <label>Délai avant envoi (s) <input type="number" [(ngModel)]="form.delaySeconds" /></label>
        <label>Nombre d'envois <input type="number" min="1" [(ngModel)]="form.repeat" /></label>
        <label>Intervalle entre deux envois (s) <input type="number" [(ngModel)]="form.intervalSeconds" /></label>
        <p>Destinataires :</p>
        @for (p of phones(); track p.id) {
          @if (p.hasSubscription) {
            <label>
              <input type="checkbox" [checked]="selected().has(p.id)" (change)="toggle(p.id)" />
              {{ p.name || 'sans nom' }} · {{ p.context }} ({{ p.pushHost }})
            </label>
          }
        }
        <button class="primary" (click)="send()" [disabled]="!selected().size">Envoyer</button>
      </section>

      <div>
        <section>
          <h2>Envois</h2>
          <table>
            <tr>
              <th>n°</th><th>Téléphone</th><th>Titre</th><th>Réglages</th><th>Envoyé</th><th>Réponse</th><th>Vu par le worker</th><th>Ouvert</th>
            </tr>
            @for (s of sends(); track s.n) {
              <tr>
                <td>{{ s.n }}</td>
                <td>{{ s.phoneName }}</td>
                <td>{{ s.title }}<br /><span class="muted">{{ s.body }}</span></td>
                <td class="muted">{{ s.format }}, {{ s.urgency }}, TTL {{ s.ttl }}{{ s.tag ? ', tag ' + s.tag : '' }}{{ s.topic ? ', Topic ' + s.topic : '' }}</td>
                <td>{{ s.sentAt ? time(s.sentAt) : 'prévu ' + time(s.scheduledAt) }}</td>
                <td [class]="s.status && s.status < 300 ? 'ok' : 'ko'">{{ s.status ?? '' }} {{ s.ms !== undefined ? s.ms + ' ms' : '' }}<br /><span class="muted">{{ s.response }}</span></td>
                <td>{{ s.receivedAt ? time(s.receivedAt) + ' (+' + delay(s.sentAt, s.receivedAt) + ')' : '' }}<br /><span class="muted">{{ s.receivedSource }}</span></td>
                <td>{{ s.clickedAt ? time(s.clickedAt) + ' par ' + s.via : '' }}</td>
              </tr>
            }
          </table>
        </section>

        @for (p of phones(); track p.id) {
          <section>
            <h2>{{ p.name || 'sans nom' }} · {{ p.context }} <span class="muted">({{ p.id }})</span></h2>
            <dl>
              <dt>Agent</dt>
              <dd>{{ p.userAgent }}</dd>
              <dt>Vu</dt>
              <dd>{{ dateTime(p.lastSeen) }}</dd>
              <dt>Abonnement</dt>
              <dd>{{ p.hasSubscription ? p.pushHost + ', par ' + p.subscriptionVia + ' à ' + time(p.subscriptionAt) : 'aucun' }}</dd>
            </dl>
            <pre class="journal">@for (e of reversed(p.journal); track $index) {{{ time(e.at) }} {{ e.from === 'serveur' ? '[serveur] ' : '' }}{{ e.text }}
}</pre>
            <button (click)="forget(p.id)">Oublier ce téléphone</button>
          </section>
        }
      </div>
    </div>
  `,
})
export class Control implements OnInit, OnDestroy {
  protected readonly templates = TEMPLATES;
  protected readonly checks = CHECKS;
  // Lue une fois : le rafraîchissement toutes les 2 s n'écrase pas une saisie en cours.
  protected readonly findings = signal<Findings | null>(null);
  protected readonly copied = signal('');
  protected readonly time = time;
  protected readonly dateTime = dateTime;
  protected readonly encode = encodeURIComponent;
  protected readonly links = [
    { label: 'Manifeste avec start_url', url: `${location.origin}/?code=LABO42` },
    { label: 'Manifeste B, sans start_url', url: `${location.origin}/?code=LABO42&manifeste=b` },
  ];
  protected readonly key = signal(localStorage.getItem(KEY_STORAGE) ?? new URLSearchParams(location.search).get('cle') ?? '');
  protected readonly error = signal('');
  protected readonly phones = signal<PhoneView[]>([]);
  protected readonly sends = signal<SendView[]>([]);
  protected readonly selected = signal(new Set<string>());
  protected readonly templateIndex = signal(0);
  protected form = {
    title: TEMPLATES[0].title,
    body: TEMPLATES[0].body,
    format: 'double',
    mutable: false,
    tag: 'creneau-2-nouvelle-partie',
    topic: 'creneau-2-nouvelle-partie',
    urgency: 'high',
    ttl: 3600,
    delaySeconds: 0,
    repeat: 1,
    intervalSeconds: 5,
  };
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), 2000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  protected saveKey(key: string) {
    this.key.set(key);
    localStorage.setItem(KEY_STORAGE, key);
    void this.refresh();
  }

  protected pick(index: number) {
    const template = TEMPLATES[index];
    this.templateIndex.set(index);
    this.form.title = template.title;
    this.form.body = template.body;
    this.form.tag = template.replaces ? 'creneau-2-nouvelle-partie' : '';
    this.form.topic = template.replaces ? 'creneau-2-nouvelle-partie' : '';
  }

  protected toggle(id: string) {
    const next = new Set(this.selected());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected.set(next);
  }

  protected reversed<T>(list: T[]): T[] {
    return [...list].reverse();
  }

  protected delay(from: number | undefined, to: number) {
    return from ? `${((to - from) / 1000).toFixed(1)} s` : '?';
  }

  protected async send() {
    try {
      await api('POST', '/api/pilotage/envois', { ...this.form, phoneIds: [...this.selected()] }, this.headers());
      await this.refresh();
    } catch (error) {
      this.error.set(String(error));
    }
  }

  protected async forget(id: string) {
    await api('DELETE', `/api/pilotage/telephones/${id}`, undefined, this.headers());
    await this.refresh();
  }

  protected cell(check: string, device: string) {
    return this.findings()?.cells[`${check}|${device}`] ?? { verdict: '', note: '' };
  }

  protected setCell(check: string, device: string, field: 'verdict' | 'note', value: string) {
    const f = this.findings()!;
    const key = `${check}|${device}`;
    this.saveFindings({ ...f, cells: { ...f.cells, [key]: { ...this.cell(check, device), [field]: value } } });
  }

  protected addDevice(label: string) {
    if (!label.trim()) return;
    const f = this.findings()!;
    this.saveFindings({ ...f, devices: [...f.devices, { id: crypto.randomUUID().slice(0, 8), label: label.trim() }] });
  }

  protected removeDevice(id: string) {
    const f = this.findings()!;
    if (confirm('Retirer cet appareil et ses constats ?')) this.saveFindings({ ...f, devices: f.devices.filter((d) => d.id !== id) });
  }

  private saveFindings(findings: Findings) {
    this.findings.set(findings);
    api('POST', '/api/pilotage/constats', findings, this.headers()).catch((error) => this.error.set(String(error)));
  }

  // Texte à coller en commentaire de résolution de #53.
  protected async copyMarkdown() {
    const f = this.findings()!;
    const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const lines = [
      '## Constats sur appareil',
      '',
      `Labo : ${location.origin} (branche \`prototype/labo-telephones\`). Relevé le ${dateTime(Date.now())}.`,
      '',
      '### Appareils',
      '',
      ...f.devices.map((d) => `- ${d.label}`),
      '',
      '### Grille',
      '',
      `| Vérification | ${f.devices.map((d) => cell(d.label)).join(' | ')} |`,
      `|---|${f.devices.map(() => '---').join('|')}|`,
      ...CHECKS.map((c) => {
        const values = f.devices.map((d) => {
          const { verdict, note } = this.cell(c.id, d.id);
          return cell([verdict, note].filter(Boolean).join(' : '));
        });
        return `| ${c.label} | ${values.join(' | ')} |`;
      }),
      '',
      '### Envois',
      '',
      '| n° | Téléphone | Titre | Réglages | HTTP | Vu par le worker | Ouvert |',
      '|---|---|---|---|---|---|---|',
      ...[...this.sends()].reverse().map((s) =>
        [
          s.n,
          s.phoneName,
          s.title,
          `${s.format}, ${s.urgency}, TTL ${s.ttl}${s.tag ? ', tag' : ''}${s.topic ? ', Topic' : ''}`,
          `${s.status ?? s.response ?? ''}`,
          s.receivedAt ? `${time(s.receivedAt)} (+${this.delay(s.sentAt, s.receivedAt)})` : '',
          s.clickedAt ? `${time(s.clickedAt)} par ${s.via}` : '',
        ]
          .map((v) => cell(String(v)))
          .join(' | ')
          .replace(/^/, '| ')
          .concat(' |'),
      ),
      '',
      '<details><summary>Journaux</summary>',
      '',
      ...this.phones().flatMap((p) => [
        `#### ${p.name || 'sans nom'} · ${p.context} (${p.id})`,
        '',
        `Agent : \`${p.userAgent}\``,
        '',
        '```',
        ...p.journal.slice(-150).map((e) => `${time(e.at)} ${e.from === 'serveur' ? '[serveur] ' : ''}${e.text}`),
        '```',
        '',
      ]),
      '</details>',
    ];
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(`Copié (${text.length} caractères)`);
    } catch {
      this.copied.set('Copie refusée par le navigateur');
    }
  }

  private headers() {
    return { 'x-labo-cle': this.key() };
  }

  private async refresh() {
    try {
      const state = await api<{ phones: PhoneView[]; sends: SendView[]; findings: Findings }>(
        'GET',
        '/api/pilotage/etat',
        undefined,
        this.headers(),
      );
      this.phones.set(state.phones);
      this.sends.set(state.sends);
      if (!this.findings()) this.findings.set(state.findings);
      this.error.set('');
    } catch (error) {
      this.error.set(String(error));
    }
  }
}
