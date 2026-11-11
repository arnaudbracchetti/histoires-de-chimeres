/** Une écriture qui ne vient pas du site lui-même (ADR 0019) : 403. */
export class CrossSiteRequestError extends Error {
  constructor() {
    super('cross-site-request');
    this.name = 'CrossSiteRequestError';
  }
}
