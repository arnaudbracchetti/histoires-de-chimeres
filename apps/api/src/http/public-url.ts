/**
 * L'adresse publique du site, `PUBLIC_URL`, sans `/` final (`https://chimeres.example.org`), ou
 * `null` si elle manque. Les notifications l'ouvrent ; les liens d'accès s'y construisent.
 */
export function readPublicUrl(): string | null {
  return process.env['PUBLIC_URL']?.replace(/\/+$/, '') || null;
}
