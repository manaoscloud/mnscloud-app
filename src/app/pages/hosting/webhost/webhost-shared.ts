import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import {
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

export const WEBHOST_PROVIDER_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'cpanel_whm', label: 'cPanel/WHM' },
];

export const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

export const WEBHOST_HOST_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'error', label: 'Error' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const WEBHOST_PROVISION_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'pending', label: 'Pending' },
  { value: 'provisioning', label: 'Provisioning' },
  { value: 'provisioned', label: 'Provisioned' },
  { value: 'failed', label: 'Failed' },
];

export const WEBHOST_TOOL_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'error', label: 'Error' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const WEBHOST_ZONE_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'error', label: 'Error' },
  { value: 'deleted', label: 'Deleted' },
];

export const WEBHOST_ZONE_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'A', label: 'A' },
  { value: 'AAAA', label: 'AAAA' },
  { value: 'CNAME', label: 'CNAME' },
  { value: 'MX', label: 'MX' },
  { value: 'TXT', label: 'TXT' },
  { value: 'SRV', label: 'SRV' },
  { value: 'CAA', label: 'CAA' },
];

export const WEBHOST_ACCESS_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

export function webhostRootEndpoint(isMaster: boolean): string {
  return isMaster ? 'system/hosting/webhost' : 'hosting/webhost';
}

export function truthyNumber(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function stringValue(value: unknown): string {
  return typeof value === 'string'
    ? value
    : value === null || value === undefined
      ? ''
      : String(value);
}

export function numberOrNull(value: unknown): number | null {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

export function normalizeString(value: unknown): string | null {
  const trimmed = stringValue(value).trim();
  return trimmed ? trimmed : null;
}

export function cleanRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => item !== null && item !== undefined && item !== '',
    ),
  );
}

/** Remap ConfigurableCrud Status filter (0/1) to API `isActive` while keeping lifecycle `status`. */
export function appendWebhostListParams(
  params: URLSearchParams,
  filters: ConfigurableCrudFilters,
  listFilters: readonly { key: string; paramKey?: string }[],
): void {
  params.set('limit', '500');
  params.set('offset', '0');
  if (filters.search) params.set('search', filters.search);
  if (filters.status !== '') params.set('isActive', String(filters.status));
  for (const filter of listFilters) {
    const value = filters.extra[filter.key];
    if (value === null || value === undefined || value === '') continue;
    params.set(filter.paramKey ?? filter.key, String(value));
  }
}

export function lifecycleChipClass(value: unknown): string {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'active' || normalized === 'provisioned') return 'chip-success';
  if (
    normalized === 'error' ||
    normalized === 'failed' ||
    normalized === 'suspended' ||
    normalized === 'cancelled' ||
    normalized === 'deleted'
  ) {
    return 'chip-warning';
  }
  return 'chip-skipped';
}

@Component({
  selector: 'app-webhost-password-prompt-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title | transloco }}</h2>
    <mat-dialog-content>
      <p>{{ data.message | transloco }}</p>
      <mat-form-field appearance="outline" class="full-width" style="width: 100%">
        <mat-label>{{ 'Password' | transloco }}</mat-label>
        <input
          matInput
          type="password"
          [(ngModel)]="password"
          autocomplete="new-password"
          (keydown.enter)="confirm()"
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">{{ 'Cancel' | transloco }}</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="password.trim().length < 8"
        (click)="confirm()"
      >
        {{ 'Confirm' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
})
export class WebhostPasswordPromptDialog {
  readonly data = inject<{ title: string; message: string }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<WebhostPasswordPromptDialog, string | null>);
  password = '';

  cancel() {
    this.dialogRef.close(null);
  }

  confirm() {
    const value = this.password.trim();
    if (value.length < 8) return;
    this.dialogRef.close(value);
  }
}

export async function promptWebhostPassword(
  dialog: MatDialog,
  title: string,
  message: string,
): Promise<string | null> {
  const ref = dialog.open(WebhostPasswordPromptDialog, {
    width: 'min(480px, calc(100vw - 24px))',
    maxWidth: 'calc(100vw - 24px)',
    disableClose: true,
    autoFocus: false,
    data: { title, message },
  });
  const result = await firstValueFrom(ref.afterClosed());
  return typeof result === 'string' && result.trim().length >= 8 ? result.trim() : null;
}

export function hostOptionLabel(row: ConfigurableCrudRecord): string {
  const name = stringValue(row['HwhName'] || row['HostName']);
  const domain = stringValue(row['DomainName']);
  const username = stringValue(row['HwhUsername'] || row['HostUsername']);
  return [name, domain, username].filter(Boolean).join(' · ') || '-';
}
