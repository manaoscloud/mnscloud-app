import { Injectable, effect, inject } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

import { AppI18nService } from '../../services/app-i18n.service';
import { parseDateInput } from './date-input-format';

@Injectable()
export class MnsNativeDateAdapter extends NativeDateAdapter {
  private readonly i18n = inject(AppI18nService);

  constructor() {
    super();
    effect(() => this.setLocale(this.i18n.language()));
  }

  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseDateInput(value, this.i18n.language());
    return parsed ?? this.invalid();
  }

  override deserialize(value: unknown): Date | null {
    if (typeof value === 'string') {
      const parsed = parseDateInput(value, this.i18n.language());
      return parsed ?? this.invalid();
    }

    return super.deserialize(value);
  }
}
