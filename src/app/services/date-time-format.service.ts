import { Injectable, computed, inject, signal } from '@angular/core';

import { AppI18nService } from './app-i18n.service';
import { SystemParameterService } from './system-parameter.service';

type DateTimeStyle = 'short' | 'medium' | 'long' | 'full';

@Injectable({ providedIn: 'root' })
export class DateTimeFormatService {
  private readonly i18n = inject(AppI18nService);
  private readonly parameters = inject(SystemParameterService);

  readonly timezone = signal('UTC');
  readonly locale = computed(() => this.i18n.language());

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.timezone.set(await this.parameters.resolveDefaultTimezone('UTC'));
  }

  formatDateTime(
    value: Date | string | number | null | undefined,
    dateStyle: DateTimeStyle = 'short',
    timeStyle: DateTimeStyle = 'medium',
  ): string {
    const date = this.parseDate(value);
    if (!date) return '';

    return this.format(date, {
      dateStyle,
      timeStyle,
      timeZone: this.timezone(),
    });
  }

  formatDate(
    value: Date | string | number | null | undefined,
    dateStyle: DateTimeStyle = 'short',
  ): string {
    const date = this.parseDate(value);
    if (!date) return '';

    return this.format(date, {
      dateStyle,
      timeZone: this.timezone(),
    });
  }

  toEpoch(value: Date | string | number | null | undefined): number {
    return this.parseDate(value)?.getTime() ?? 0;
  }

  private parseDate(value: Date | string | number | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private format(date: Date, options: Intl.DateTimeFormatOptions): string {
    try {
      return new Intl.DateTimeFormat(this.locale(), options).format(date);
    } catch {
      return new Intl.DateTimeFormat(this.locale(), { ...options, timeZone: 'UTC' }).format(date);
    }
  }
}
