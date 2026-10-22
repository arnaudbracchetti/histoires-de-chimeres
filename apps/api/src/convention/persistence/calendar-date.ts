/**
 * Une date sans heure (`AAAA-MM-JJ`) et la colonne `DATE` de PostgreSQL, que Prisma lit et écrit
 * en `Date` à minuit UTC.
 */
export function toDatabaseDate(date: string | null): Date | null {
  return date === null ? null : new Date(`${date}T00:00:00.000Z`);
}

export function fromDatabaseDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}
