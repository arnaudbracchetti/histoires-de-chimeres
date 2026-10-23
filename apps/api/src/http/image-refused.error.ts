import type { ApiErrorCode } from '@chimeres/contract';

/** Image refusée par l'API avant le domaine (ADR 0007) : son statut vient du catalogue. */
export class ImageRefusedError extends Error {
  constructor(
    readonly code: Extract<
      ApiErrorCode,
      'image-too-large' | 'image-format-unsupported' | 'image-unreadable' | 'image-not-found'
    >,
  ) {
    super(code);
    this.name = 'ImageRefusedError';
  }
}
