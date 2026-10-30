/** Le serveur n'a pas de clés VAPID : le push n'est pas pris en charge (404). */
export class PushNotConfiguredError extends Error {
  constructor() {
    super('push-not-configured');
    this.name = 'PushNotConfiguredError';
  }
}
