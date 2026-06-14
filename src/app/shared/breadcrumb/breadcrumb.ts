import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon'; // ✅ IMPORT NECESSÁRIO
import { filter } from 'rxjs/operators';

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
  private readonly destroyRef = inject(DestroyRef);

  readonly crumbs = signal<Crumb[]>([]);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.buildBreadcrumbs());

    this.buildBreadcrumbs();
  }

  private buildBreadcrumbs() {
    const url = this.router.url;
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
