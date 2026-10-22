import { Catch, HttpException, HttpStatus, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';
import { StaleConventionError } from '@chimeres/application';
import type { ProblemCode, ProblemDto, RefusalCode, RefusalParams } from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import { MalformedRequestError } from './malformed-request.error.js';
import { problemCatalogue } from './problem-catalogue.js';

/**
 * Traduit toute erreur en Problem Details (RFC 9457, ADR 0008) : les controllers ne font aucun
 * `try/catch`. Les autres `HttpException` (404 d'une route inconnue) gardent la réponse de Nest.
 */
@Catch()
export class ProblemFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  override catch(error: unknown, host: ArgumentsHost): void {
    const problem = this.problemOf(error);
    if (!problem) return super.catch(error, host);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(problem.status)
      .type('application/problem+json')
      .send(JSON.stringify(problem));
  }

  private problemOf(error: unknown): ProblemDto | undefined {
    if (error instanceof Refusal) {
      const code: RefusalCode = error.code;
      const status = problemCatalogue[code].status ?? HttpStatus.UNPROCESSABLE_ENTITY;
      return problem(status, error.code, error.params);
    }
    if (error instanceof MalformedRequestError || isUnreadableBody(error)) {
      return problem(HttpStatus.BAD_REQUEST, 'malformed-request', {});
    }
    if (error instanceof StaleConventionError) {
      return problem(HttpStatus.CONFLICT, 'concurrent-modification', {});
    }
    if (error instanceof HttpException) return undefined;
    this.logger.error(error);
    return problem(HttpStatus.INTERNAL_SERVER_ERROR, 'internal-error', {});
  }
}

function problem<C extends ProblemCode>(
  status: number,
  code: C,
  params: C extends RefusalCode ? RefusalParams[C] : Record<string, never>,
): ProblemDto {
  const message = problemCatalogue[code] as {
    title: string;
    detail?: (params: unknown) => string;
    field?: string;
  };
  const detail = message.detail?.(params);
  return {
    type: `urn:histoires-de-chimeres:problem:${code}`,
    title: message.title,
    status,
    ...(detail && { detail }),
    code,
    ...(message.field && {
      errors: [{ field: message.field, code, message: detail ?? message.title }],
    }),
  };
}

/** Corps JSON illisible : body-parser le signale par une erreur de statut 400. */
function isUnreadableBody(error: unknown): boolean {
  if (error instanceof HttpException) return error.getStatus() === HttpStatus.BAD_REQUEST;
  return (error as { type?: unknown } | null)?.type === 'entity.parse.failed';
}
