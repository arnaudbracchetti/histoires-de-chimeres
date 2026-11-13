import { HttpErrorResponse } from '@angular/common/http';
import { readProblem } from './problem';

const refused = (status: number, error: object | null) =>
  new HttpErrorResponse({ status, statusText: 'Erreur', error });

describe('readProblem', () => {
  it("garde le texte de l'API pour une indisponibilité qu'elle explique (503)", () => {
    const problem = readProblem(
      refused(503, {
        code: 'public-url-missing',
        title: 'Adresse du site manquante',
        detail: 'Ajoute-la.',
      }),
    );

    expect(problem.notice).toEqual({ title: 'Adresse du site manquante', detail: 'Ajoute-la.' });
  });

  it('reste sobre sur un 500, et sur une erreur sans Problem Details', () => {
    const generic = { title: 'Une erreur est survenue, réessaie.' };
    expect(
      readProblem(refused(500, { code: 'internal-error', title: 'Erreur interne' })).notice,
    ).toEqual(generic);
    expect(readProblem(refused(502, null)).notice).toEqual(generic);
  });
});
