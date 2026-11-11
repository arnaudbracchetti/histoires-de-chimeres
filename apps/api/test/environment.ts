/**
 * Pose ces variables d'environnement, à `undefined` pour en retirer une, et rend de quoi remettre
 * les valeurs d'avant.
 */
export function setEnvironment(variables: Record<string, string | undefined>): () => void {
  const before = Object.fromEntries(
    Object.keys(variables).map((name) => [name, process.env[name]]),
  );
  const apply = (values: Record<string, string | undefined>) => {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
  apply(variables);
  return () => apply(before);
}
