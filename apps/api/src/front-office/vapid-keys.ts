/** Les clés VAPID qui signent les envois push, et le contact donné aux services push. */
export type VapidKeys = {
  publicKey: string;
  privateKey: string;
  /** `mailto:` ou `https:`, que les services push contactent en cas d'abus. */
  subject: string;
};

/**
 * Les clés VAPID des variables d'environnement, ou `null` s'il en manque une : rien ne part, et la
 * clé publique n'est pas servie (dev, démo).
 */
export function vapidKeysFromEnvironment(): VapidKeys | null {
  const publicKey = process.env['VAPID_PUBLIC_KEY'];
  const privateKey = process.env['VAPID_PRIVATE_KEY'];
  const subject = process.env['VAPID_SUBJECT'];
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}
