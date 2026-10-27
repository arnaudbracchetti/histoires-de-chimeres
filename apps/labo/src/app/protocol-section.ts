import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { dateTime, time } from './lab';
import type { Protocol, Step } from './protocols';

export interface ProtocolRun {
  device: string;
  startedAt: number | null;
  results: Record<string, { verdict: string; note: string }>;
}

export interface JournalPhone {
  id: string;
  name: string;
  context: string;
  userAgent: string;
  journal: { at: number; text: string; from: string }[];
}

const EMPTY_RESULT = { verdict: '', note: '' };

// Un protocole du pilotage : les gestes à faire sur le téléphone, étape par étape, les lignes du
// journal qui la concernent, et la saisie de son résultat.
@Component({
  selector: 'labo-protocol',
  imports: [FormsModule],
  styles: `
    h3 {
      margin: 20px 0 8px;
      font-size: 1rem;
    }
    input[type='text'] {
      width: min(100%, 480px);
    }
    .step {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      margin: 0 0 10px;
      background: var(--surface-0);
    }
    .step.done {
      border-color: var(--accent);
    }
    .step h4 {
      margin: 0 0 8px;
      font-size: 0.95rem;
    }
    .step-body {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 12px;
    }
    .heading {
      margin: 8px 0 4px;
      color: var(--text-muted);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    ol,
    ul {
      margin: 0;
      padding-left: 20px;
    }
    li {
      margin: 2px 0;
    }
    .result {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .result select {
      width: auto;
    }
    .result textarea {
      flex: 1;
      min-width: 240px;
    }
    .journal {
      max-height: 160px;
    }
  `,
  template: `
    @let p = protocol();
    <h2>Protocole : {{ p.title }}</h2>
    <p>
      Ticket :
      <a [href]="'https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/' + p.issue.number" target="_blank">
        {{ p.issue.title }}
      </a>
    </p>
    <p>{{ p.purpose }}</p>

    <p class="heading">Avant de commencer</p>
    <ul>
      @for (line of p.setup; track line) {
        <li>{{ line }}</li>
      }
    </ul>

    <label>
      Appareil
      <input type="text" [ngModel]="run().device" (change)="setDevice($any($event.target).value)" [placeholder]="p.devicePlaceholder" />
    </label>
    <button class="primary" (click)="start()">Commencer une série</button>
    <span class="muted">
      {{ run().startedAt ? 'Série commencée le ' + dateTime(run().startedAt!) : 'Pas de série en cours : le journal ne s’affiche pas sous les étapes.' }}
      · {{ filled() }} / {{ steps().length }} étapes renseignées
    </span>

    @for (part of p.parts; track part.title) {
      <h3>{{ part.title }}</h3>
      @if (part.intro) {
        <p class="muted">{{ part.intro }}</p>
      }
      @for (step of part.steps; track step.id) {
        <article class="step" [class.done]="!!result(step).verdict">
          <h4>{{ number(step) }}. {{ step.title }}</h4>
          <div class="step-body">
            <div>
              <p class="heading">Gestes</p>
              <ol>
                @for (action of step.actions; track action) {
                  <li>{{ action }}</li>
                }
              </ol>
              <p class="heading">À noter</p>
              <ul>
                @for (line of step.observe; track line) {
                  <li>{{ line }}</li>
                }
              </ul>
            </div>
            <div>
              @if (step.journal) {
                <p class="heading">Vu par le labo</p>
                <pre class="journal">@for (e of lines(step); track $index) {{{ time(e.at) }} {{ e.phone }}{{ e.from === 'serveur' ? ' [serveur]' : '' }} : {{ e.text }}
} @empty {{{ run().startedAt ? 'rien encore' : '—' }}}</pre>
              }
              <p class="heading">Résultat : {{ step.question }}</p>
              <div class="result">
                <select [ngModel]="result(step).verdict" (ngModelChange)="setResult(step, 'verdict', $event)">
                  <option value="">—</option>
                  <option value="oui">oui</option>
                  <option value="non">non</option>
                  <option value="partiel">partiel</option>
                  <option value="pas fait">pas fait</option>
                </select>
                <textarea rows="3" [ngModel]="result(step).note" (change)="setResult(step, 'note', $any($event.target).value)" placeholder="Ce qui a été vu, libellés exacts, délais"></textarea>
              </div>
            </div>
          </div>
        </article>
      }
    }

    <p class="muted">À la fin : « Copier en Markdown », et coller le texte en commentaire de résolution du ticket, avec les captures d’écran.</p>
    <button class="primary" (click)="copyMarkdown()">Copier en Markdown</button>
    @if (copied()) {
      <span class="ok">{{ copied() }}</span>
    }
  `,
})
export class ProtocolSection {
  readonly protocol = input.required<Protocol>();
  readonly run = input.required<ProtocolRun>();
  readonly phones = input.required<JournalPhone[]>();
  readonly runChange = output<ProtocolRun>();

  protected readonly time = time;
  protected readonly dateTime = dateTime;
  protected readonly copied = signal('');
  protected readonly steps = computed(() => this.protocol().parts.flatMap((part) => part.steps));
  protected readonly filled = computed(() => this.steps().filter((step) => this.result(step).verdict).length);

  protected number(step: Step): number {
    return this.steps().indexOf(step) + 1;
  }

  protected result(step: Step) {
    return this.run().results[step.id] ?? EMPTY_RESULT;
  }

  protected setDevice(device: string) {
    this.runChange.emit({ ...this.run(), device });
  }

  protected setResult(step: Step, field: 'verdict' | 'note', value: string) {
    const run = this.run();
    this.runChange.emit({ ...run, results: { ...run.results, [step.id]: { ...this.result(step), [field]: value } } });
  }

  protected start() {
    const run = this.run();
    if (Object.keys(run.results).length && !confirm('Effacer les résultats de la série en cours ?')) return;
    this.runChange.emit({ device: run.device, startedAt: Date.now(), results: {} });
  }

  // Lignes de tous les téléphones écrites depuis le début de la série, et que l'étape regarde.
  protected lines(step: Step) {
    const { startedAt } = this.run();
    if (!step.journal || !startedAt) return [];
    return this.phones()
      .flatMap((p) =>
        p.journal
          .filter((e) => e.at >= startedAt && step.journal!.test(e.text))
          .map((e) => ({ ...e, phone: `${p.name || 'sans nom'} · ${p.context}` })),
      )
      .sort((a, b) => a.at - b.at)
      .slice(-8);
  }

  // Texte à coller en commentaire de résolution du ticket.
  protected async copyMarkdown() {
    const p = this.protocol();
    const run = this.run();
    const since = run.startedAt ?? 0;
    const phones = this.phones().filter((phone) => phone.journal.some((e) => e.at >= since));
    const lines = [
      '## Constats sur appareil',
      '',
      `Protocole « ${p.title} » du labo (${location.origin}/pilotage, branche \`prototype/labo-telephones\`).` +
        `${run.startedAt ? ` Série commencée le ${dateTime(run.startedAt)}.` : ''} Appareil : ${run.device || 'non précisé'}.`,
      '',
      ...p.parts.flatMap((part) => [
        `### ${part.title}`,
        '',
        ...part.steps.map((step) => {
          const { verdict, note } = this.result(step);
          const answer = [verdict ? `**${verdict}**.` : '_non renseigné_.', note.trim().replace(/\n/g, '\n  ')];
          return `- **${this.number(step)}. ${step.title}**\n  ${step.question} ${answer.filter(Boolean).join(' ')}`;
        }),
        '',
      ]),
      '<details><summary>Journaux de la série</summary>',
      '',
      ...phones.flatMap((phone) => [
        `#### ${phone.name || 'sans nom'} · ${phone.context} (${phone.id})`,
        '',
        `Agent : \`${phone.userAgent}\``,
        '',
        '```',
        ...phone.journal
          .filter((e) => e.at >= since)
          .slice(-200)
          .map((e) => `${time(e.at)} ${e.from === 'serveur' ? '[serveur] ' : ''}${e.text}`),
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
}
