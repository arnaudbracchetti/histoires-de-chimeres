import { Component, computed, inject, signal } from '@angular/core';
import { frontOfficeEndpoints } from '@chimeres/contract';
import { apiResource } from './api-resource';
import { AppUpdate } from './app-update';
import { ConventionEndedPage } from './convention-ended-page';
import { NicknamePage } from './identification/nickname-page';
import { LinkedPhone } from './linked-phone';
import { AppInstallation } from './installation/app-installation';
import { AppInstalledPage } from './installation/app-installed-page';
import { InstallAppPage } from './installation/install-app-page';
import { EnableNotificationsPage } from './notifications/enable-notifications-page';
import { PushNotifications } from './notifications/push-notifications';
import { PresenceCodePage } from './presence-code-page';
import { PresenceCodeStore } from './presence-code-store';
import { isNetworkFailure, readProblem } from './problem';
import { AlertStack } from './shell/alert-stack';
import { Shell } from './shell/shell';

/**
 * L'entrée du front office : un téléphone relié à un pseudo entre dans la coquille ; sinon, il
 * s'identifie, derrière le code de présence, demandé s'il manque (ADR 0009). Juste après, il passe
 * par « Active les notifications », si le téléphone ne les a encore ni accordées ni refusées (§4.2),
 * puis, sur Android dans le navigateur, par « Installe l'application ». Quand le navigateur a installé
 * l'application, « L'application est installée » prend la place de l'écran.
 */
@Component({
  selector: 'app-root',
  imports: [
    AlertStack,
    AppInstalledPage,
    ConventionEndedPage,
    EnableNotificationsPage,
    InstallAppPage,
    NicknamePage,
    PresenceCodePage,
    Shell,
  ],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly frontOffice = apiResource(frontOfficeEndpoints.read);
  protected readonly presenceCode = inject(PresenceCodeStore).code;
  protected readonly linkedPhone = inject(LinkedPhone);
  private readonly push = inject(PushNotifications);
  protected readonly installation = inject(AppInstallation);

  /** Le téléphone vient d'être relié, sans avoir répondu aux notifications : leur étape est à faire. */
  private readonly notificationsStepDue = signal(false);
  protected readonly notificationsStep = computed(
    () => this.notificationsStepDue() && this.push.status() !== 'unsupported',
  );

  /** Le téléphone vient d'être relié, sur Android dans le navigateur : l'étape d'installation suit. */
  private readonly installStepDue = signal(false);
  protected readonly installStep = computed(
    () => this.installStepDue() && this.installation.offered(),
  );

  /** Les étapes qui suivent la liaison, chacune si elle a lieu d'être. */
  protected readonly onboarding = computed(
    () => this.notificationsStep() || this.installStep() || this.installation.justInstalled(),
  );

  /** Seul un téléphone qui n'a ni accordé ni refusé les notifications passe par leur étape. */
  protected linked(): void {
    this.notificationsStepDue.set(this.push.status() === 'default');
    this.installStepDue.set(this.installation.offered());
  }

  protected notificationsDone(): void {
    this.notificationsStepDue.set(false);
  }

  protected installDone(): void {
    this.installStepDue.set(false);
  }

  constructor() {
    inject(AppUpdate);
  }

  /**
   * Un écran a vu la fin de la convention : refus `convention-ended` à l'identification, ou fin du
   * dernier créneau dans la coquille, selon l'heure du téléphone.
   */
  protected readonly endedOnScreen = signal(false);
  protected readonly ended = computed(
    () =>
      this.endedOnScreen() ||
      (!!this.frontOffice.error() &&
        readProblem(this.frontOffice.error()).code === 'convention-ended'),
  );
  protected readonly failed = computed(
    () => !!this.frontOffice.error() || this.linkedPhone.failed(),
  );
  /** Première ouverture sans réseau : aucune copie hors ligne à montrer. */
  protected readonly offline = computed(
    () => isNetworkFailure(this.frontOffice.error()) || this.linkedPhone.offline(),
  );
  protected readonly loading = computed(
    () => !this.frontOffice.hasValue() || this.linkedPhone.nickname() === undefined,
  );
}
