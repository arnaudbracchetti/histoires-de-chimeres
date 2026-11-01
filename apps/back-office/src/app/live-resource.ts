import { DOCUMENT } from '@angular/common';
import type { HttpResourceRef } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import { formatAgeLine } from '@chimeres/design';
import type { LoadableResource } from './shell/loadable';

/** Relecture tant que l'onglet est visible (§6, Fraîcheur). */
const REREAD_EVERY_MS = 30_000;

/** Une lecture qui se tient à jour seule, sans rien interrompre : voir `liveResource()`. */
export type LiveResource<T> = {
  /** La dernière valeur lue, gardée quand une relecture échoue ; `undefined` avant la première. */
  readonly value: Signal<T | undefined>;
  /**
   * Ce que `app-loadable` montre : la première lecture seule, avec sa barre de progression et son
   * échec. Une relecture ne l'affiche pas.
   */
  readonly firstRead: LoadableResource;
  /** Une lecture est en cours, première ou relecture. */
  readonly isLoading: Signal<boolean>;
  /**
   * « Pas de connexion · à jour à 14 h 05 » quand une lecture échoue plus de 2 minutes après la
   * dernière réussie, jusqu'à la suivante qui aboutit ; `null` sinon.
   */
  readonly ageLine: Signal<string | null>;
  /** Relit, en silence. */
  reload(): void;
};

/**
 * Tient `resource` à jour (§6, Fraîcheur) : relue toutes les 30 s tant que l'onglet est visible,
 * et au retour sur l'onglet. La page la relit aussi après chaque geste, par `reload()`. Une
 * relecture est silencieuse : la valeur change à l'arrivée, sans barre de progression, et une
 * lecture qui échoue garde la dernière. À créer dans un champ.
 */
export function liveResource<T>(resource: HttpResourceRef<T | undefined>): LiveResource<T> {
  const document = inject(DOCUMENT);
  /** La dernière lecture réussie, et son heure. */
  const lastRead = linkedSignal<T | undefined, { value: T; readAt: Date } | undefined>({
    source: () => (resource.hasValue() ? resource.value() : undefined),
    computation: (value, previous) =>
      value === undefined ? previous?.value : { value, readAt: new Date() },
  });
  /** L'heure du dernier échec : une lecture en cours ne dit rien de la connexion. */
  const failedAt = linkedSignal<unknown, Date | undefined>({
    source: () => resource.error(),
    computation: (error, previous) => (error ? new Date() : previous?.value),
  });
  const hasRead = computed(() => lastRead() !== undefined);

  /**
   * Une lecture partie avant le geste ne le montre peut-être pas, et la ressource refuse de la
   * relancer avant sa fin quand elle n'a pas de valeur : la relecture attend cette fin.
   */
  const deferred = signal(false);
  const reload = () => {
    if (!resource.reload()) deferred.set(true);
  };
  effect(() => {
    if (!deferred() || resource.isLoading()) return;
    deferred.set(false);
    untracked(() => resource.reload());
  });
  const isVisible = () => document.visibilityState === 'visible';
  const timer = setInterval(() => {
    if (isVisible()) reload();
  }, REREAD_EVERY_MS);
  const rereadOnReturn = () => {
    if (isVisible()) reload();
  };
  document.addEventListener('visibilitychange', rereadOnReturn);
  inject(DestroyRef).onDestroy(() => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', rereadOnReturn);
  });

  return {
    value: computed(() => lastRead()?.value),
    firstRead: {
      isLoading: computed(() => !hasRead() && resource.isLoading()),
      error: computed(() => (hasRead() ? undefined : resource.error())),
      reload: () => {
        reload();
        return true;
      },
    },
    isLoading: resource.isLoading,
    ageLine: computed(() => {
      const read = lastRead();
      const failed = failedAt();
      return read && failed && failed > read.readAt ? formatAgeLine(read.readAt, failed) : null;
    }),
    reload,
  };
}
