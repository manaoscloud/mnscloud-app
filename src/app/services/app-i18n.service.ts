import { computed, Injectable, signal, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type AppLanguage = 'pt-BR' | 'en-US' | 'es-ES';
export type LanguageOptionCode = AppLanguage | 'auto';
type AppLanguageMode = 'auto' | 'manual';

const LANGUAGE_STORAGE_KEY = 'mc_language';
const LANGUAGE_MODE_STORAGE_KEY = 'mc_language_mode';

export function detectAppLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return 'en-US';
  const browserLanguage = navigator.language.toLowerCase();
  if (browserLanguage.startsWith('pt')) return 'pt-BR';
  if (browserLanguage.startsWith('es')) return 'es-ES';
  return 'en-US';
}

export function resolveInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en-US';
  const mode = localStorage.getItem(LANGUAGE_MODE_STORAGE_KEY);
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);

  if (mode === 'manual' && isAppLanguage(stored)) return stored;
  return detectAppLanguage();
}

function resolveInitialLanguageMode(): AppLanguageMode {
  if (typeof window === 'undefined') return 'auto';
  return localStorage.getItem(LANGUAGE_MODE_STORAGE_KEY) === 'manual' ? 'manual' : 'auto';
}

function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'pt-BR' || value === 'en-US' || value === 'es-ES';
}

@Injectable({ providedIn: 'root' })
export class AppI18nService {
  private readonly transloco = inject(TranslocoService);

  readonly languageOptions = [
    { code: 'auto' as const, labelKey: 'lang.auto' },
    { code: 'pt-BR' as AppLanguage, labelKey: 'lang.portuguese' },
    { code: 'en-US' as AppLanguage, labelKey: 'lang.english' },
    { code: 'es-ES' as AppLanguage, labelKey: 'lang.spanish' },
  ];

  readonly availableLanguages = [
    { code: 'pt-BR' as AppLanguage, labelKey: 'lang.portuguese' },
    { code: 'en-US' as AppLanguage, labelKey: 'lang.english' },
    { code: 'es-ES' as AppLanguage, labelKey: 'lang.spanish' },
  ];

  readonly language = signal<AppLanguage>(resolveInitialLanguage());
  readonly languageMode = signal<AppLanguageMode>(resolveInitialLanguageMode());
  readonly selectedLanguageOption = computed<LanguageOptionCode>(() =>
    this.languageMode() === 'auto' ? 'auto' : this.language(),
  );

  constructor() {
    const initialLanguage = this.language();
    this.transloco.setActiveLang(initialLanguage);
    this.syncDocumentLanguage(initialLanguage);
    this.bindNavigatorLanguageChange();
  }

  t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }

  setLanguage(language: AppLanguage, reload = false) {
    this.language.set(language);
    this.languageMode.set('manual');
    this.transloco.setActiveLang(language);

    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      localStorage.setItem(LANGUAGE_MODE_STORAGE_KEY, 'manual');
    }

    this.syncDocumentLanguage(language);

    if (reload && typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  useSystemLanguage(reload = false) {
    const systemLanguage = detectAppLanguage();
    this.languageMode.set('auto');
    this.language.set(systemLanguage);
    this.transloco.setActiveLang(systemLanguage);

    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_MODE_STORAGE_KEY, 'auto');
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    }

    this.syncDocumentLanguage(systemLanguage);

    if (reload && typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  private syncDocumentLanguage(language: AppLanguage) {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }

  private bindNavigatorLanguageChange() {
    if (typeof window === 'undefined') return;

    window.addEventListener('languagechange', () => {
      if (this.languageMode() !== 'auto') return;
      const systemLanguage = detectAppLanguage();
      this.language.set(systemLanguage);
      this.transloco.setActiveLang(systemLanguage);
      this.syncDocumentLanguage(systemLanguage);
    });
  }
}
