import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { ProblemDto, ScenarioBody, ScenarioDto } from '@chimeres/contract';
import { ScenarioForm } from './scenario-form';

const SCENARIO: ScenarioDto = {
  id: 's1',
  gameMaster: { id: 'g1', nickname: 'Kaïros' },
  title: "La Tour d'ébène",
  system: "L'Appel de Cthulhu",
  presentation: 'Une tour, une nuit.',
  contentWarnings: '',
  seats: { min: 3, max: 5 },
  duration: 1,
  imageUrl: null,
};

describe('ScenarioForm', () => {
  async function render(scenario?: ScenarioDto) {
    const fixture = TestBed.createComponent(ScenarioForm);
    const save = vi.fn<(body: ScenarioBody) => Promise<ScenarioDto>>();
    fixture.componentRef.setInput('save', save);
    if (scenario) fixture.componentRef.setInput('scenario', scenario);
    const saved: ScenarioDto[] = [];
    fixture.componentInstance.saved.subscribe((dto) => saved.push(dto));
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \t\n]+/g, ' ').trim() ?? '';
    const labelOf = (label: string) =>
      [...host.querySelectorAll('label')].find((l) => l.textContent?.trim().startsWith(label))!;
    const control = (label: string) => labelOf(label).control as HTMLInputElement;
    const fieldOf = (label: string) => labelOf(label).closest('app-field')!;
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    const type = async (label: string, value: string, { leave = true } = {}) => {
      const field = control(label);
      field.value = value;
      field.dispatchEvent(new Event('input'));
      if (leave) field.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
    };
    const errorOf = (label: string) => text(fieldOf(label).querySelector('.error'));
    const counterOf = (label: string) => text(fieldOf(label).querySelector('.counter'));
    const button = (name: string) =>
      [...host.querySelectorAll('button')].find((b) => text(b) === name)!;
    const submit = async () => {
      button('Enregistrer').click();
      await settle();
    };
    return {
      fixture,
      host,
      save,
      saved,
      text,
      control,
      type,
      errorOf,
      counterOf,
      button,
      submit,
      settle,
    };
  }

  describe('compteurs', () => {
    it.each([
      ['Titre', '80'],
      ['Jeu', '60'],
      ['Présentation', '1\u202f500'],
      ['Avertissements de contenu', '300'],
    ])('« %s » compte ses caractères sur %s', async (label, max) => {
      const { type, counterOf } = await render();

      expect(counterOf(label)).toBe(`0 / ${max}`);
      await type(label, 'a'.repeat(42), { leave: false });
      expect(counterOf(label)).toBe(`42 / ${max}`);
    });

    it('part du scénario modifié', async () => {
      const { counterOf } = await render(SCENARIO);

      expect(counterOf('Titre')).toBe('15 / 80');
    });
  });

  it('marque les avertissements de contenu comme facultatifs, et eux seuls', async () => {
    const { host, text } = await render();

    const optional = [...host.querySelectorAll('label')]
      .filter((label) => label.querySelector('.optional'))
      .map((label) => label.firstChild?.textContent?.trim());
    expect(optional).toEqual(['Avertissements de contenu']);
    expect(text(host.querySelector('.optional'))).toBe('facultatif');
  });

  describe('erreurs locales', () => {
    it('s’affichent quand on quitte le champ, pas avant', async () => {
      const { type, errorOf } = await render();

      await type('Titre', 'a'.repeat(81), { leave: false });
      expect(errorOf('Titre')).toBe('');
      await type('Titre', 'a'.repeat(81));
      expect(errorOf('Titre')).toBe('Le titre fait 80 caractères au plus : raccourcis-le.');
    });

    it('se mettent à jour à chaque frappe une fois le champ quitté', async () => {
      const { type, errorOf } = await render();

      await type('Jeu', '');
      expect(errorOf('Jeu')).toBe('Indique le jeu du scénario.');
      await type('Jeu', 'Dune', { leave: false });
      expect(errorOf('Jeu')).toBe('');
    });

    it('refusent des places dans le désordre sous le maximum', async () => {
      const { type, errorOf } = await render();

      await type('Places minimum', '5');
      await type('Places maximum', '3');

      expect(errorOf('Places maximum')).toBe('Le maximum est sous le minimum : augmente-le.');
      expect(errorOf('Places minimum')).toBe('');
    });

    it('refusent un minimum de 0 sous le minimum', async () => {
      const { type, errorOf } = await render();

      await type('Places minimum', '0');

      expect(errorOf('Places minimum')).toBe('Il faut au moins 1 place.');
    });
  });

  it('« Enregistrer » n’est jamais désactivé : l’envoi est bloqué et le focus va au premier champ en erreur', async () => {
    const { button, submit, save, control, errorOf } = await render();

    expect(button('Enregistrer').disabled).toBe(false);
    await submit();

    expect(save).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(control('Titre'));
    expect(errorOf('Titre')).toBe('Donne un titre au scénario.');
    expect(errorOf('Places minimum')).toBe('Indique le nombre minimum de places.');
  });

  it('envoie le scénario saisi, places en nombres et durée en créneaux', async () => {
    const { type, control, submit, save, saved, fixture } = await render();
    save.mockResolvedValue(SCENARIO);

    await type('Titre', "La Tour d'ébène");
    await type('Jeu', "L'Appel de Cthulhu");
    await type('Présentation', 'Une tour, une nuit.');
    await type('Places minimum', '3');
    await type('Places maximum', '5');
    control('2 créneaux').click();
    await fixture.whenStable();
    await submit();

    expect(save).toHaveBeenCalledWith({
      title: "La Tour d'ébène",
      system: "L'Appel de Cthulhu",
      presentation: 'Une tour, une nuit.',
      contentWarnings: '',
      seats: { min: 3, max: 5 },
      duration: 2,
    });
    expect(saved).toEqual([SCENARIO]);
  });

  it('pose une erreur de l’API sous son champ (seats.max)', async () => {
    const { submit, save, errorOf } = await render(SCENARIO);
    const problem: Partial<ProblemDto> = {
      title: 'Places dans le désordre',
      code: 'seats-out-of-order',
      errors: [{ field: 'seats.max', code: 'seats-out-of-order', message: 'Refus de l’API.' }],
    };
    save.mockRejectedValue(new HttpErrorResponse({ status: 422, error: problem }));

    await submit();

    expect(errorOf('Places maximum')).toBe('Refus de l’API.');
  });

  describe('modifications non enregistrées', () => {
    it('n’en a aucune à l’ouverture', async () => {
      const { fixture } = await render(SCENARIO);

      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('en a une dès qu’un champ change, et plus si on revient à la valeur enregistrée', async () => {
      const { fixture, type } = await render(SCENARIO);

      await type('Titre', 'Autre titre');
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
      await type('Titre', "La Tour d'ébène");
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('n’en a plus une fois enregistrées', async () => {
      const { fixture, type, submit, save } = await render(SCENARIO);
      save.mockResolvedValue({ ...SCENARIO, title: 'Autre titre' });

      await type('Titre', 'Autre titre');
      await submit();

      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('aperçu de la présentation', () => {
    it('montre le rendu de la présentation, puis revient à la saisie', async () => {
      const { type, button, host, control, fixture } = await render();

      await type(
        'Présentation',
        '**gras**, *italique*\n\n- un\n- deux\n\n[lien](https://exemple.fr)',
      );
      button('Aperçu').click();
      await fixture.whenStable();

      const preview = host.querySelector('app-presentation-preview')!;
      expect(preview.querySelector('strong')?.textContent).toBe('gras');
      expect(preview.querySelector('em')?.textContent).toBe('italique');
      expect([...preview.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
        'un',
        'deux',
      ]);
      expect(preview.querySelector('a')).toBeNull();
      expect(preview.textContent).toContain('[lien](https://exemple.fr)');
      expect(button('Aperçu').getAttribute('aria-pressed')).toBe('true');

      button('Écrire').click();
      await fixture.whenStable();
      expect(host.querySelector('app-presentation-preview')).toBeNull();
      expect(control('Présentation').closest('[hidden]')).toBeNull();
    });

    it('revient à la saisie pour mettre le focus sur une présentation en erreur', async () => {
      const { type, button, submit, control, fixture } = await render();
      await type('Titre', 'Titre');
      await type('Jeu', 'Jeu');
      button('Aperçu').click();
      await fixture.whenStable();

      await submit();

      expect(document.activeElement).toBe(control('Présentation'));
    });
  });
});
