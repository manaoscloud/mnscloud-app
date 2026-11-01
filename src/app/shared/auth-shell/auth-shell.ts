import { toSignal } from '@angular/core/rxjs-interop';
import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AppI18nService, LanguageOptionCode } from '../../services/app-i18n.service';
import {
  PublicThemeContextService,
  PublicThemeRuntimeContext,
} from '../../services/public-theme-context.service';
import { ThemeService } from '../../services/theme.service';
import { MNS_MENU } from '../menu/mns-menu';
import {
  brandColor,
  LoginAppearance,
  LoginLocale,
  loginText,
  onBrandColor,
  safeAppearanceUrl,
} from './login-appearance';

@Component({
  selector: 'mns-auth-shell',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, TranslocoPipe, ...MNS_MENU],
  templateUrl: './auth-shell.html',
  styleUrl: './auth-shell.scss',
})
export class AuthShell {
  readonly publicTheme = inject(PublicThemeContextService);
  readonly i18n = inject(AppI18nService);
  private readonly translations = inject(TranslocoService);
  private readonly translationEvents = toSignal(this.translations.events$);
  private readonly theme = inject(ThemeService);
  readonly previewContext = input<PublicThemeRuntimeContext | null>(null);
  readonly previewLocale = input<LoginLocale | null>(null);
  readonly previewMobile = input(false);
  readonly preview = input(false);
  readonly module = input<'app' | 'pulse' | 'pos' | 'phoneweb' | 'infragis'>('app');
  readonly failedLogo = signal<string | null>(null);
  readonly context = computed(() => this.previewContext() ?? this.publicTheme.context());
  readonly appearance = computed<LoginAppearance>(() => this.context()?.LoginAppearance ?? {});
  readonly language = computed(() => this.previewLocale() ?? this.i18n.language());
  readonly title = computed(
    () =>
      this.context()?.PageTitle ||
      {
        app: 'MNSCloud',
        pulse: 'MNSCloud Pulse',
        pos: 'MNSCloud POS',
        phoneweb: 'MNSCloud PhoneWeb',
        infragis: 'MNSCloud InfraGIS',
      }[this.module()],
  );
  readonly color = computed(() => brandColor(this.context()?.PrimaryColor));
  readonly foreground = computed(() => onBrandColor(this.color()));
  readonly mode = computed(() =>
    this.appearance().appearance === 'system' || !this.appearance().appearance
      ? this.theme.theme()
      : this.appearance().appearance!,
  );
  readonly logo = computed(() => {
    const url = this.context()?.LogoUrl;
    return url && this.failedLogo() !== url ? url : null;
  });
  readonly heroImage = computed(() => safeAppearanceUrl(this.appearance().heroImageUrl));
  readonly support = computed(() => safeAppearanceUrl(this.appearance().supportUrl));
  readonly privacy = computed(() => safeAppearanceUrl(this.appearance().privacyUrl));
  readonly terms = computed(() => safeAppearanceUrl(this.appearance().termsUrl));
  text(key: 'eyebrow' | 'heroTitle' | 'heroText' | 'supportLabel'): string {
    this.translationEvents();
    return (
      loginText(this.appearance(), this.language(), key) ||
      this.translations.translate(`access.${this.module()}.${key}`, {}, this.language())
    );
  }
  label(key: string): string {
    this.translationEvents();
    return this.translations.translate(key, {}, this.language());
  }
  changeLanguage(language: LanguageOptionCode) {
    if (language === 'auto') this.i18n.useSystemLanguage();
    else this.i18n.setLanguage(language);
  }
}
