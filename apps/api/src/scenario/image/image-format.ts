/** Formats acceptés à l'envoi (PR-7) : les seuls que sharp décode ici. */
export type AcceptedFormat = 'jpeg' | 'png' | 'webp' | 'avif';

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

/**
 * Le format d'un fichier d'après ses magic numbers, jamais d'après le type déclaré par le
 * navigateur, ou `null` s'il n'est pas accepté.
 */
export function acceptedFormatOf(bytes: Uint8Array): AcceptedFormat | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return 'png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  // Boîte `ftyp` d'ISO BMFF : `avif` pour une image fixe, `avis` pour une séquence.
  if (ascii(bytes, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(bytes, 8, 12)))
    return 'avif';
  return null;
}
