import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { StaleConventionError } from '@chimeres/application';
import { Refusal } from '@chimeres/domain';
import { ProblemFilter } from './problem.filter.js';

/** Réponse Express réduite à ce que le filtre utilise. */
function respond(error: unknown) {
  const sent = { status: 0, type: '', body: undefined as unknown };
  const response = {
    status(status: number) {
      sent.status = status;
      return response;
    },
    type(type: string) {
      sent.type = type;
      return response;
    },
    send(body: string) {
      sent.body = JSON.parse(body);
      return response;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  new ProblemFilter().catch(error, host);
  return sent;
}

describe('ProblemFilter', () => {
  beforeEach(() => vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => vi.restoreAllMocks());

  it('traduit une erreur inattendue en 500 internal-error, sans détail', () => {
    const sent = respond(new Error('connexion perdue à la base'));

    expect(sent.status).toBe(500);
    expect(sent.type).toBe('application/problem+json');
    expect(sent.body).toEqual({
      type: 'urn:histoires-de-chimeres:problem:internal-error',
      title: 'Erreur interne',
      status: 500,
      code: 'internal-error',
    });
  });

  it('traduit une version périmée en 409 concurrent-modification', () => {
    const sent = respond(new StaleConventionError());

    expect(sent.status).toBe(409);
    expect(sent.body).toMatchObject({ code: 'concurrent-modification', status: 409 });
    expect(sent.body).not.toHaveProperty('errors');
  });

  it('écrit le détail d’un refus avec ses paramètres', () => {
    const sent = respond(new Refusal('convention-name-too-long', { max: 80 }));

    expect(sent.status).toBe(422);
    expect(sent.body).toMatchObject({
      title: 'Nom trop long',
      detail: 'Le nom de la convention fait 80 caractères au plus : raccourcis-le.',
      errors: [
        {
          field: 'name',
          code: 'convention-name-too-long',
          message: 'Le nom de la convention fait 80 caractères au plus : raccourcis-le.',
        },
      ],
    });
  });
});
