import {
  Component,
  AfterViewInit,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Router,
  RouterOutlet,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
} from '@angular/router';
import { trigger, transition, style, animate, query, group } from '@angular/animations';

import { RouteLoader } from './shared/route-loader/route-loader';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouteLoader],
  template: `
    <!-- Loader global durante navegação -->
    <app-route-loader />

    <!-- Conteúdo principal com animação entre rotas -->
    <main [@routeFadeAnimation]="getRouteAnimationState(outlet)" class="app-container">
      <router-outlet #outlet="outlet" />
    </main>
  `,
  styles: [
    `
      .app-container {
        display: block;
        min-height: 100vh;
        overflow-x: hidden;
        background: var(--app-bg, #f9fafb);
        transition: background-color 0.3s ease;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('routeFadeAnimation', [
      transition('* <=> *', [
        // garante layout consistente no enter/leave
        query(':enter, :leave', style({ position: 'fixed', width: '100%' }), { optional: true }),
        group([
          // fade-out rota anterior
          query(':leave', [style({ opacity: 1 }), animate('250ms ease', style({ opacity: 0 }))], {
            optional: true,
          }),
          // fade-in rota nova
          query(':enter', [style({ opacity: 0 }), animate('300ms ease', style({ opacity: 1 }))], {
            optional: true,
          }),
        ]),
      ]),
    ]),
  ],
})
export class App implements AfterViewInit {
  private router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private hideLoaderTimer: ReturnType<typeof setTimeout> | null = null;

  readonly loader = viewChild.required(RouteLoader);

  constructor() {
    this.destroyRef.onDestroy(() => this.clearLoaderHideTimer());
  }

  ngAfterViewInit() {
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.loader()?.show?.();
        }

        if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
        ) {
          this.scheduleLoaderHide();
        }
      });
  }

  private scheduleLoaderHide() {
    this.clearLoaderHideTimer();
    this.hideLoaderTimer = setTimeout(() => {
      this.hideLoaderTimer = null;
      this.loader()?.hide?.();
    }, 200);
  }

  private clearLoaderHideTimer() {
    if (!this.hideLoaderTimer) return;
    clearTimeout(this.hideLoaderTimer);
    this.hideLoaderTimer = null;
  }

  getRouteAnimationState(outlet: RouterOutlet): string {
    if (!outlet?.isActivated) return 'none';

    const route = outlet.activatedRoute;
    const data = route.snapshot.data;

    // Nunca retorna null — isso elimina o NG0100
    return data?.['animation'] || route.snapshot.url.map((u) => u.path).join('/') || 'none';
  }
}
