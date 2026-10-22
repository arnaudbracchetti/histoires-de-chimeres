import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { MalformedRequestError } from './malformed-request.error.js';

/** Vérifie la forme d'un corps par son schéma zod : `@Body(new ZodBody(schema))`. Les règles restent au domaine. */
export class ZodBody<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new MalformedRequestError(result.error.issues);
    return result.data;
  }
}
