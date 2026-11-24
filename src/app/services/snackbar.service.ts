import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppI18nService } from './app-i18n.service';
import { ToastAction, ToastItem, ToastType } from '../shared/toast/toast.model';

export type SnackType = ToastType;
export type { ToastAction, ToastItem, ToastType };

interface TimerEntry {
  timeoutId?: ReturnType<typeof setTimeout>;
  startedAt: number;
  duration: number;
  remainingTime: number;
}

const MAX_VISIBLE_TOASTS = 5;
const DISMISS_ANIMATION_MS = 220;

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 5000,
  error: 6000,
};

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private readonly snack = inject(MatSnackBar, { optional: true });
  private readonly i18n = inject(AppI18nService);

  private readonly timers = new Map<string, TimerEntry>();
  private nextId = 0;

  readonly toasts = signal<ToastItem[]>([]);
  readonly isPaused = signal<boolean>(false);

  private translateParams(params?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!params) return undefined;
    const translated: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('i18n:')) {
        translated[key] = this.i18n.t(value.slice('i18n:'.length));
      } else {
        translated[key] = value;
      }
    }
    return translated;
  }

  private open(
    type: SnackType,
    message: string,
    duration?: number,
    params?: Record<string, unknown>,
    action?: ToastAction,
  ): string {
    const translatedMessage = this.i18n.t(message, this.translateParams(params));
    const resolvedDuration = duration ?? (action ? 8000 : DEFAULT_DURATIONS[type]);

    // Deduplication: if exact same toast (type + message) is already visible, increment count and reset timer
    const current = this.toasts();
    const existingIndex = current.findIndex(
      (t) => !t.dismissing && t.type === type && t.message === translatedMessage,
    );

    if (existingIndex !== -1) {
      const existing = current[existingIndex];
      const updatedItem: ToastItem = {
        ...existing,
        count: existing.count + 1,
        duration: resolvedDuration,
        remainingTime: resolvedDuration,
      };

      this.toasts.update((items) =>
        items.map((item, idx) => (idx === existingIndex ? updatedItem : item)),
      );

      this.resetTimer(existing.id, resolvedDuration);
      return existing.id;
    }

    // Limit maximum visible toasts by auto-dismissing oldest active
    const activeToasts = current.filter((t) => !t.dismissing);
    if (activeToasts.length >= MAX_VISIBLE_TOASTS) {
      const oldest = activeToasts[0];
      if (oldest) {
        this.dismiss(oldest.id);
      }
    }

    const id = `toast-${++this.nextId}-${Date.now()}`;
    const newItem: ToastItem = {
      id,
      type,
      message: translatedMessage,
      duration: resolvedDuration,
      count: 1,
      action,
      dismissing: false,
      createdAt: Date.now(),
      remainingTime: resolvedDuration,
    };

    this.toasts.update((items) => [...items, newItem]);
    this.scheduleTimer(id, resolvedDuration);

    return id;
  }

  private scheduleTimer(id: string, duration: number) {
    if (duration <= 0) return;

    const timerEntry: TimerEntry = {
      startedAt: Date.now(),
      duration,
      remainingTime: duration,
    };

    if (!this.isPaused()) {
      timerEntry.timeoutId = setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    this.timers.set(id, timerEntry);
  }

  private resetTimer(id: string, duration: number) {
    const existing = this.timers.get(id);
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }
    this.scheduleTimer(id, duration);
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer?.timeoutId) {
      clearTimeout(timer.timeoutId);
    }
    this.timers.delete(id);

    const items = this.toasts();
    const target = items.find((t) => t.id === id);
    if (!target || target.dismissing) {
      return;
    }

    // Trigger smooth exit animation
    this.toasts.update((list) => list.map((t) => (t.id === id ? { ...t, dismissing: true } : t)));

    setTimeout(() => {
      this.toasts.update((list) => list.filter((t) => t.id !== id));
    }, DISMISS_ANIMATION_MS);
  }

  pause(): void {
    if (this.isPaused()) return;
    this.isPaused.set(true);

    const now = Date.now();
    for (const [id, timer] of this.timers.entries()) {
      if (timer.timeoutId) {
        clearTimeout(timer.timeoutId);
        timer.timeoutId = undefined;
      }
      const elapsed = now - timer.startedAt;
      timer.remainingTime = Math.max(1000, timer.remainingTime - elapsed);
    }
  }

  resume(): void {
    if (!this.isPaused()) return;
    this.isPaused.set(false);

    const now = Date.now();
    for (const [id, timer] of this.timers.entries()) {
      timer.startedAt = now;
      timer.timeoutId = setTimeout(() => {
        this.dismiss(id);
      }, timer.remainingTime);
    }
  }

  clearAll(): void {
    for (const [, timer] of this.timers.entries()) {
      if (timer.timeoutId) {
        clearTimeout(timer.timeoutId);
      }
    }
    this.timers.clear();

    this.toasts.update((list) => list.map((t) => ({ ...t, dismissing: true })));

    setTimeout(() => {
      this.toasts.set([]);
    }, DISMISS_ANIMATION_MS);
  }

  success(message: string, duration = 4000, params?: Record<string, unknown>): string {
    return this.open('success', message, duration, params);
  }

  error(message: string, duration = 6000, params?: Record<string, unknown>): string {
    return this.open('error', message, duration, params);
  }

  /** Error toast with one action button (for example "Report problem"). */
  errorWithAction(
    message: string,
    actionLabel: string,
    onAction: () => void,
    duration = 8000,
    params?: Record<string, unknown>,
  ): string {
    let toastId = '';
    const action: ToastAction = {
      label: this.i18n.t(actionLabel),
      onClick: () => {
        try {
          onAction();
        } finally {
          if (toastId) {
            this.dismiss(toastId);
          }
        }
      },
    };

    toastId = this.open('error', message, duration, params, action);
    return toastId;
  }

  warning(message: string, duration = 5000, params?: Record<string, unknown>): string {
    return this.open('warning', message, duration, params);
  }

  info(message: string, duration = 4000, params?: Record<string, unknown>): string {
    return this.open('info', message, duration, params);
  }
}
