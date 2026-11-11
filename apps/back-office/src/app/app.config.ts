import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { redirectToLoginWhenLoggedOut } from './account/redirect-to-login.interceptor';
import { routes } from './app.routes';
import { PageTitle } from './page-title';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useClass: PageTitle },
    provideHttpClient(withFetch(), withInterceptors([redirectToLoginWhenLoggedOut])),
  ],
};
