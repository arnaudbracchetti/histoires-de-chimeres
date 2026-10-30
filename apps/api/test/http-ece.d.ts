/** `http_ece` n'a pas de types : le faux service push n'en lit que le déchiffrement. */
declare module 'http_ece' {
  import type { ECDH } from 'node:crypto';

  const ece: {
    decrypt(
      buffer: Buffer,
      params: { version: 'aes128gcm'; privateKey: ECDH; authSecret: string },
    ): Buffer;
  };
  export default ece;
}
