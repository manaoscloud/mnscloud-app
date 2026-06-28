import {
  ApplicationConfig,
  importProvidersFrom,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';

import { registerLocaleData } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import localeEn from '@angular/common/locales/en';
import localeEs from '@angular/common/locales/es';
import localePt from '@angular/common/locales/pt';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { TitleStrategy } from '@angular/router';
import { apiInterceptor } from './core/interceptors/api.interceptor';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { AppI18nService, resolveInitialLanguage } from './services/app-i18n.service';
import { TranslocoHttpLoader } from './services/transloco-loader';
import { PublicThemeContextService } from './services/public-theme-context.service';
import { PublicThemeTitleStrategy } from './services/public-theme-title.strategy';

registerLocaleData(localeEn);
registerLocaleData(localeEs);
registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideAppInitializer(() => {
      void inject(PublicThemeContextService).load();
    }),
    provideAppInitializer(() =>
      firstValueFrom(inject(TranslocoService).load(inject(AppI18nService).language())),
    ),
    { provide: TitleStrategy, useClass: PublicThemeTitleStrategy },
    importProvidersFrom(MatSnackBarModule),
    provideHttpClient(withXhr(), withInterceptors([apiInterceptor])),
    provideTransloco({
      config: {
        availableLangs: ['pt-BR', 'en-US', 'es-ES'],
        defaultLang: resolveInitialLanguage(),
        fallbackLang: 'en-US',
        reRenderOnLangChange: true,
        prodMode: true,
      },
      loader: TranslocoHttpLoader,
    }),
    {
      provide: MAT_DATE_LOCALE,
      useFactory: () => inject(AppI18nService).language(),
    },
    {
      provide: LOCALE_ID,
      useFactory: () => resolveInitialLanguage(),
    },
  ],
};
