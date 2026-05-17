import { inject, Injectable } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { RouterStateSnapshot, TitleStrategy } from "@angular/router";
import { PublicThemeContextService } from "./public-theme-context.service";

@Injectable()
export class PublicThemeTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly publicTheme = inject(PublicThemeContextService);
  private readonly fallbackBrand = "mnscloud";

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
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
