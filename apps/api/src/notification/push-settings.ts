/**
 * Les réglages de l'envoi push : les clés VAPID qui signent les envois, le contact donné aux
 * services push, et l'adresse publique du front office, que la notification ouvre.
 */
export type PushSettings = {
  publicKey: string;
  privateKey: string;
  /** `mailto:` ou `https:`, que les services push contactent en cas d'abus. */
  subject: string;
  /** L'origine du front office, sans `/` final : `https://chimeres.example.org`. */
  publicUrl: string;
};

/**
 * Les réglages des variables d'environnement, ou `null` s'il en manque un : rien ne part, et la
 * clé publique n'est pas servie (dev, démo).
 */
export function pushSettingsFromEnvironment(): PushSettings | null {
  const publicKey = process.env['VAPID_PUBLIC_KEY'];
  const privateKey = process.env['VAPID_PRIVATE_KEY'];
  const subject = process.env['VAPID_SUBJECT'];
  const publicUrl = process.env['PUBLIC_URL']?.replace(/\/+$/, '');
  return publicKey && privateKey && subject && publicUrl
    ? { publicKey, privateKey, subject, publicUrl }
    : null;
}
