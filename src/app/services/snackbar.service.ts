import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppI18nService } from './app-i18n.service';

type SnackType = 'success' | 'error' | 'warning' | 'info';

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private readonly snack = inject(MatSnackBar);
  private readonly i18n = inject(AppI18nService);

  private open(type: SnackType, message: string, duration = 3000) {
    this.snack.open(this.i18n.t(message), this.i18n.t('snackbar.close'), {
      duration,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['snackbar', `snackbar-${type}`],
    });
  }

  success(message: string, duration = 3000) {
    this.open('success', message, duration);
  }

  error(message: string, duration = 3000) {
    this.open('error', message, duration);
  }

  warning(message: string, duration = 3000) {
    this.open('warning', message, duration);
  }

  info(message: string, duration = 3000) {
    this.open('info', message, duration);
  }
}
