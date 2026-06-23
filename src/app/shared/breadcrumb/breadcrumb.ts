import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon'; // ✅ IMPORT NECESSÁRIO

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
  private readonly navigationEvent = toSignal(this.router.events, { initialValue: null });

  readonly crumbs = signal<Crumb[]>([]);

  constructor() {
    effect(() => {
      const event = this.navigationEvent();
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

    for (const part of parts) {
      path += `/${part}`;

      items.push({
        label: this.formatLabel(part),
        url: path,
      });
    }

    this.crumbs.set(items);
  }

  private formatLabel(segment: string): string {
    return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
