import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  apiUrl,
  conventionEndpoints,
  tableEndpoints,
  type ConventionDto,
  type ProblemDto,
} from '@chimeres/contract';
import { TableList } from './table-list';

/** La convention et ses tables, dans l'ordre donné : celui que renvoie l'API. */
function conventionWith(...names: string[]): ConventionDto {
  const tables = names.map((name) => ({ id: `t-${name}`, name }));
  return { id: 'c1', name: 'Histoires de Chimères', date: null, timeSlots: [], tables };
}

describe('TableList', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  async function render(convention = conventionWith()) {
    const fixture = TestBed.createComponent(TableList);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(apiUrl(conventionEndpoints.read)).flush(convention);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \t\n]+/g, ' ').trim() ?? '';
    /** Les noms des cartes affichées, hors carte en saisie. */
    const names = () => [...host.querySelectorAll('article.card:not(.editing) h3')].map(text);
    const editor = () => host.querySelector<HTMLElement>('article.editing');
    const input = () => editor()!.querySelector('input')!;
    const type = async (value: string) => {
      input().value = value;
      input().dispatchEvent(new Event('input'));
      input().dispatchEvent(new Event('blur'));
      await fixture.whenStable();
    };
    const press = async (key: 'Enter' | 'Escape') => {
      (document.activeElement ?? input()).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      );
      await settle();
    };
    /** Un bouton de la liste ou d'un menu ouvert, par son nom accessible. */
    const button = (name: string) =>
      [...document.querySelectorAll('button')].find(
        (b) => (b.getAttribute('aria-label') ?? text(b)) === name,
      )!;
    const errorText = () => {
      const ids = input().getAttribute('aria-describedby')?.split(' ') ?? [];
      return ids.map((id) => text(host.querySelector(`#${id}`))).find(Boolean);
    };
    const cardOf = (name: string) =>
      [...host.querySelectorAll<HTMLElement>('article.card')].find(
        (card) => text(card.querySelector('h3')) === name,
      )!;
    const dialogButton = (name: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
        (b) => text(b) === name,
      )!;
    return {
      host,
      http,
      settle,
      names,
      editor,
      input,
      type,
      press,
      button,
      errorText,
      cardOf,
      dialogButton,
    };
  }

  it('montre une carte par table, dans l’ordre de l’API', async () => {
    const { names } = await render(conventionWith('Dragon', 'Table 2', 'Table 10'));

    expect(names()).toEqual(['Dragon', 'Table 2', 'Table 10']);
  });

  it('ajoute à la chaîne : après l’ajout, une nouvelle carte de saisie vide s’ouvre', async () => {
    const { button, type, http, settle, names, input } = await render(conventionWith('Dragon'));

    button('Ajouter une table').click();
    await settle();
    expect(document.activeElement).toBe(input());
    await type('Licorne');
    button('Ajouter la table').click();
    await settle();
    const request = http.expectOne(apiUrl(tableEndpoints.add));
    expect(request.request.body).toEqual({ name: 'Licorne' });
    request.flush(conventionWith('Dragon', 'Licorne'));
    await settle();

    expect(names()).toEqual(['Dragon', 'Licorne']);
    expect(input().value).toBe('');
    expect(document.activeElement).toBe(input());
  });

  it('Entrée enregistre, Échap ferme la saisie et rend le focus à « Ajouter une table »', async () => {
    const { button, type, press, http, settle, editor } = await render();
    button('Ajouter une table').click();
    await settle();

    await type('Dragon');
    await press('Enter');
    http.expectOne(apiUrl(tableEndpoints.add)).flush(conventionWith('Dragon'));
    await settle();
    await press('Escape');

    expect(editor()).toBeNull();
    expect(document.activeElement).toBe(button('Ajouter une table'));
  });

  it('un nom vide n’est signalé qu’à l’enregistrement, sans rien envoyer', async () => {
    const { button, type, press, http, settle, errorText } = await render();
    button('Ajouter une table').click();
    await settle();

    await type('  ');
    expect(errorText()).toBeUndefined();
    await press('Enter');

    http.expectNone(apiUrl(tableEndpoints.add));
    expect(errorText()).toBe('Donne un nom à la table.');
  });

  it('signale un nom trop long dès qu’on quitte le champ', async () => {
    const { button, type, settle, errorText } = await render();
    button('Ajouter une table').click();
    await settle();

    await type('a'.repeat(31));

    expect(errorText()).toBe("Le nom d'une table fait 30 caractères au plus : raccourcis-le.");
  });

  it('affiche sous le champ un nom pris refusé par l’API, sans perdre la saisie', async () => {
    const { button, type, press, http, settle, errorText, input } = await render(
      conventionWith('Dragon'),
    );
    const message = 'La table « Dragon » porte déjà ce nom : choisis-en un autre.';
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:table-name-taken',
      title: 'Nom déjà pris',
      status: 422,
      detail: message,
      code: 'table-name-taken',
      errors: [{ field: 'name', code: 'table-name-taken', message }],
    };
    button('Ajouter une table').click();
    await settle();

    await type('dragon');
    await press('Enter');
    http.expectOne(apiUrl(tableEndpoints.add)).flush(problem, { status: 422, statusText: 'Refus' });
    await settle();

    expect(errorText()).toBe(message);
    expect(input().value).toBe('dragon');
    expect(document.activeElement).toBe(input());
  });

  it('chaque carte porte l’icône des dés', async () => {
    const { host } = await render(conventionWith('Dragon'));

    expect(host.querySelector('article.card app-icon-tile use')?.getAttribute('href')).toBe(
      'icons.svg#dices',
    );
  });

  it('« Modifier » retourne la carte en saisie, et « Enregistrer » renomme la table', async () => {
    const { cardOf, input, type, button, http, settle, names, editor } = await render(
      conventionWith('Table 1', 'Table 2'),
    );

    button('Modifier la table Table 1').click();
    await settle();
    expect(input().value).toBe('Table 1');
    expect(document.activeElement).toBe(input());
    await type('Table 3');
    button('Enregistrer').click();
    await settle();
    const request = http.expectOne(apiUrl(tableEndpoints.rename, { tableId: 't-Table 1' }));
    expect(request.request.body).toEqual({ name: 'Table 3' });
    // La table renommée garde son identifiant.
    const renamed = conventionWith('Table 2', 'Table 3');
    renamed.tables[1]!.id = 't-Table 1';
    request.flush(renamed);
    await settle();

    expect(editor()).toBeNull();
    expect(names()).toEqual(['Table 2', 'Table 3']);
    expect(document.activeElement).toBe(cardOf('Table 3'));
  });

  it('« Supprimer » demande confirmation, supprime, puis met le focus à la carte suivante', async () => {
    const { button, dialogButton, http, settle, names, cardOf } = await render(
      conventionWith('Dragon', 'Licorne', 'Phénix'),
    );

    button('Supprimer la table Licorne').click();
    await settle();
    expect(document.querySelector('[role="alertdialog"] h2')?.textContent).toBe(
      'Supprimer la table « Licorne » ?',
    );
    dialogButton('Supprimer la table').click();
    http
      .expectOne(apiUrl(tableEndpoints.remove, { tableId: 't-Licorne' }))
      .flush(conventionWith('Dragon', 'Phénix'));
    await settle();

    expect(names()).toEqual(['Dragon', 'Phénix']);
    expect(document.activeElement).toBe(cardOf('Phénix'));
  });
});
