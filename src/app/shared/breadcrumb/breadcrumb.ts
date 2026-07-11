import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon'; // ✅ IMPORT NECESSÁRIO
import { AppI18nService } from '../../services/app-i18n.service';

interface Crumb {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterModule, MatIconModule],
  templateUrl: './breadcrumb.html',
  styleUrls: ['./breadcrumb.scss'],
})
export class BreadcrumbComponent {
  private router = inject(Router);
  private readonly i18n = inject(AppI18nService);
  private readonly navigationEvent = toSignal(this.router.events, { initialValue: null });

  readonly crumbs = signal<Crumb[]>([]);

  constructor() {
    effect(() => {
      const event = this.navigationEvent();
      this.i18n.language();
      if (event === null || event instanceof NavigationEnd) {
        this.buildBreadcrumbs();
      }
    });
  }

  private buildBreadcrumbs() {
    const url = this.router.url.split(/[?#]/)[0];
    const parts = url.split('/').filter(Boolean);

    const items: Crumb[] = [];
    let path = '';

    const currentBreadcrumb = this.currentBreadcrumbKey();

    for (const [index, part] of parts.entries()) {
      path += `/${part}`;

      items.push({
        label:
          index === parts.length - 1 && currentBreadcrumb
            ? this.i18n.t(currentBreadcrumb)
            : this.formatLabel(part),
        url: path,
      });
    }

    this.crumbs.set(items);
  }

  private formatLabel(segment: string): string {
    return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private currentBreadcrumbKey(): string | null {
    let snapshot = this.router.routerState.snapshot.root;
    let breadcrumb = snapshot.data['breadcrumb'];

    while (snapshot.firstChild) {
      snapshot = snapshot.firstChild;
      breadcrumb = snapshot.data['breadcrumb'] ?? breadcrumb;
    }

    return typeof breadcrumb === 'string' && breadcrumb.trim() ? breadcrumb : null;
  }
}
