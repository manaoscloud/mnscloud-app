import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  RouteConfigLoadEnd,
  RouteConfigLoadStart,
  Router,
} from '@angular/router';

@Injectable({ providedIn: 'root' })
export class NavigationLoadingService {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigationEvent = toSignal(this.router.events, { initialValue: null });

  private readonly activeNavigation = signal(false);
  private readonly lazyLoadDepth = signal(0);
  private readonly progressVisible = signal(false);
  private readonly overlayVisible = signal(false);

  private overlayTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private progressHideTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private progressStartedAt = 0;

  private static readonly MIN_PROGRESS_MS = 900;

  readonly isNavigating = computed(() => this.activeNavigation() || this.lazyLoadDepth() > 0);
  readonly showProgressBar = computed(() => this.progressVisible());
  readonly showOverlay = computed(() => this.overlayVisible() && this.isNavigating());

  constructor() {
    effect(() => {
      const event = this.navigationEvent();
      if (event instanceof NavigationStart) {
        this.startNavigation();
        return;
      }

      if (event instanceof RouteConfigLoadStart) {
        this.startLazyLoad();
        return;
      }

      if (event instanceof RouteConfigLoadEnd) {
        this.finishLazyLoad();
        return;
      }

      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.finishNavigation();
      }
    });

    this.destroyRef.onDestroy(() => this.clearTimers());
  }

  private startNavigation() {
    this.clearHideTimer();
    this.clearProgressHideTimer();
    this.lazyLoadDepth.set(0);
    this.progressStartedAt = Date.now();
    this.progressVisible.set(true);
    this.activeNavigation.set(true);
    this.scheduleOverlay();
    this.scheduleWatchdog();
  }

  private startLazyLoad() {
    if (!this.activeNavigation()) return;
    this.clearHideTimer();
    this.lazyLoadDepth.update((depth) => depth + 1);
    this.scheduleOverlay();
    this.scheduleWatchdog();
  }

  private finishLazyLoad() {
    this.lazyLoadDepth.update((depth) => Math.max(0, depth - 1));
    this.scheduleFinishIfIdle();
  }

  private finishNavigation() {
    this.finishAll();
  }

  private scheduleOverlay() {
    if (this.overlayVisible() || this.overlayTimer) return;
    this.overlayTimer = setTimeout(() => {
      this.overlayTimer = null;
      if (this.isNavigating()) {
        this.overlayVisible.set(true);
      }
    }, 350);
  }

  private scheduleWatchdog() {
    this.clearWatchdogTimer();
    this.watchdogTimer = setTimeout(() => this.finishAll(), 12000);
  }

  private scheduleFinishIfIdle() {
    if (this.isNavigating()) return;
    this.clearOverlayTimer();
    this.clearHideTimer();
    this.clearProgressHideTimer();
    this.clearWatchdogTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.overlayVisible.set(false);
    }, 140);
    this.progressHideTimer = setTimeout(() => {
      this.progressHideTimer = null;
      this.progressVisible.set(false);
    }, this.remainingProgressTime());
  }

  private finishAll() {
    this.activeNavigation.set(false);
    this.lazyLoadDepth.set(0);
    this.scheduleFinishIfIdle();
  }

  private clearTimers() {
    this.clearOverlayTimer();
    this.clearHideTimer();
    this.clearProgressHideTimer();
    this.clearWatchdogTimer();
  }

  private remainingProgressTime() {
    const elapsed = Date.now() - this.progressStartedAt;
    return Math.max(0, NavigationLoadingService.MIN_PROGRESS_MS - elapsed);
  }

  private clearOverlayTimer() {
    if (!this.overlayTimer) return;
    clearTimeout(this.overlayTimer);
    this.overlayTimer = null;
  }

  private clearHideTimer() {
    if (!this.hideTimer) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  private clearProgressHideTimer() {
    if (!this.progressHideTimer) return;
    clearTimeout(this.progressHideTimer);
    this.progressHideTimer = null;
  }

  private clearWatchdogTimer() {
    if (!this.watchdogTimer) return;
    clearTimeout(this.watchdogTimer);
    this.watchdogTimer = null;
  }
}
