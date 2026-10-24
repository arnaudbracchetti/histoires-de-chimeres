/**
 * Heure saisie, sur 24 heures, remise en `HH:MM` : « 14:00 », « 9:30 », « 9 », « 14h », « 14h30 ».
 * `undefined` si ce n'est pas une heure de 00:00 à 23:59.
 */
export function normalizeTime(text: string): string | undefined {
  const match = /^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?$/i.exec(text.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return undefined;
  return timeOf(hours * 60 + minutes);
}

/** Minutes depuis minuit d'une heure `HH:MM`. */
export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

/** Heure `HH:MM` de minutes depuis minuit. */
export function timeOf(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
