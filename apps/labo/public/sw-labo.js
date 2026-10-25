// PROTOTYPE (#59). Le service worker d'Angular, tel quel, plus un écouteur qui signale
// au serveur l'arrivée d'un push : de quoi mesurer le délai de livraison.
// Un message déclaratif sans `mutable` n'arrive jamais ici (Safari l'affiche seul).
importScripts('./ngsw-worker.js');

self.addEventListener('push', (event) => {
  let n = null;
  let source = 'data';
  try {
    n = event.data ? event.data.json().notification.data.n : null;
  } catch {}
  if (n === null && event.notification) {
    source = 'event.notification';
    n = event.notification.data ? event.notification.data.n : null;
  }
  event.waitUntil(
    self.registration.pushManager
      .getSubscription()
      .then((subscription) =>
        fetch('/api/recus', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription && subscription.endpoint, n, source, at: Date.now() }),
        }),
      )
      .catch(() => {}),
  );
});
