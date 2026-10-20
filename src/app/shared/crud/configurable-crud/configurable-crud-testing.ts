import { Provider, Type } from '@angular/core';
import { TestModuleMetadata } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { SystemParameterService } from '../../../services/system-parameter.service';
import { AsyncOperationsService } from '../../operations/async-operations.service';

/**
 * Spec-only TestBed module for a test page extending ConfigurableCrudPageBase: translations
 * without keys, router, the given API/snackbar doubles and fixed system defaults.
 */
export function configurableCrudTestingModule(options: {
  page: Type<unknown>;
  api: unknown;
  snackbar: unknown;
  langs?: readonly string[];
  providers?: Provider[];
}): TestModuleMetadata {
  const langs = options.langs ?? ['en-US'];
  return {
    imports: [
      options.page,
      TranslocoTestingModule.forRoot({
        langs: Object.fromEntries(langs.map((lang) => [lang, {}])),
        translocoConfig: {
          availableLangs: [...langs],
          defaultLang: 'en-US',
          missingHandler: { logMissingKey: false },
        },
        preloadLangs: true,
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: options.api },
      { provide: SnackbarService, useValue: options.snackbar },
      {
        provide: SystemParameterService,
        useValue: {
          resolveDefaultCurrency: () => Promise.resolve('BRL'),
          resolveDefaultTimezone: () => Promise.resolve('UTC'),
          resolveDefaultLanguage: () => Promise.resolve('en-US'),
        },
      },
      { provide: AsyncOperationsService, useValue: { observe: () => false } },
      ...(options.providers ?? []),
    ],
  };
}
