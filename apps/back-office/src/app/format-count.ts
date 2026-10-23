/** « 1 500 » : espace fine insécable pour les milliers (docs/design/ton.md). */
export function formatCount(count: number): string {
  return count.toLocaleString('fr-FR').replace(/\s/g, ' ');
}
