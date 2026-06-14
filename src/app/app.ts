import {
  afterNextRender,
  Component,
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
import { RouteLoader } from './shared/route-loader/route-loader';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouteLoader],
  template: `
    <!-- Loader global durante navegação -->
    <app-route-loader />

    <!-- Conteúdo principal -->
    <main class="app-container" animate.enter="app-route-enter">
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
})
export class App {
  private router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private hideLoaderTimer: ReturnType<typeof setTimeout> | null = null;

  readonly loader = viewChild.required(RouteLoader);

  constructor() {
    this.destroyRef.onDestroy(() => this.clearLoaderHideTimer());

    afterNextRender(() => {
      this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
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
}
