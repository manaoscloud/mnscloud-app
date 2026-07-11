import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { APP_BUILD_INFO } from '../app-build-info';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(
      `/i18n/${lang}.json?v=${encodeURIComponent(APP_BUILD_INFO.version)}`,
    );
  }
}
