import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppI18nService } from './app-i18n.service';

type SnackType = 'success' | 'error' | 'warning' | 'info';

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private readonly snack = inject(MatSnackBar);
  private readonly i18n = inject(AppI18nService);

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

  private open(type: SnackType, message: string, duration = 3000, params?: Record<string, unknown>) {
    this.snack.open(this.i18n.t(message, this.translateParams(params)), this.i18n.t('snackbar.close'), {
      duration,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['snackbar', `snackbar-${type}`],
    });
  }

  success(message: string, duration = 3000, params?: Record<string, unknown>) {
    this.open('success', message, duration, params);
  }

  error(message: string, duration = 3000, params?: Record<string, unknown>) {
    this.open('error', message, duration, params);
  }

  warning(message: string, duration = 3000, params?: Record<string, unknown>) {
    this.open('warning', message, duration, params);
  }

  info(message: string, duration = 3000, params?: Record<string, unknown>) {
    this.open('info', message, duration, params);
  }
}
