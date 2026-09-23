import { AppI18nService } from './app-i18n.service';
import { TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { effect, inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { PublicThemeContextService } from './public-theme-context.service';

@Injectable()
export class PublicThemeTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly publicTheme = inject(PublicThemeContextService);
  private readonly fallbackBrand = 'mnscloud';

  private readonly i18n = inject(AppI18nService);
  private readonly translationEvent = toSignal(inject(TranslocoService).events$);
  private readonly routeTitle = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      this.i18n.language();
      this.translationEvent();
      this.renderTitle();
    });
  }
  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.routeTitle.set(this.buildTitle(snapshot));
  }
  private renderTitle(): void {
    const raw = this.routeTitle();
    const routeTitle = raw
      ?.replace(/\s*\|\s*mnscloud\s*$/i, '')
      .split(' • ')
      .map((key) => this.i18n.t(key))
      .join(' • ');
    const brand = this.publicTheme.brandTitle() || this.fallbackBrand;

    if (!routeTitle) {
      this.title.setTitle(brand);
      return;
    }

    this.title.setTitle(this.withRuntimeBrand(routeTitle, brand));
  }

  private withRuntimeBrand(routeTitle: string, brand: string): string {
    const suffixPattern = /\s*\|\s*mnscloud\s*$/i;
    if (suffixPattern.test(routeTitle)) {
      return routeTitle.replace(suffixPattern, ` | ${brand}`);
    }

    if (routeTitle.trim().toLowerCase() === this.fallbackBrand) {
      return brand;
    }

    return `${routeTitle} | ${brand}`;
  }
}
