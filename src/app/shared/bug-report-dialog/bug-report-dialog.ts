import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import { BugReportCreated, BugReportService } from '../../services/bug-report.service';
import {
  MnsSearchSelectFieldComponent,
  MnsSearchSelectFieldOption,
} from '../forms/mns-search-select-field/mns-search-select-field';

export interface BugReportDialogData {
  url?: string;
}

type CatalogRow = { Name?: string; Code?: string; IsDefault?: number } & Record<string, unknown>;
type CatalogOption = MnsSearchSelectFieldOption & { code: string; isDefault: boolean };

function catalogOptions(rows: CatalogRow[] | undefined, uuidField: string): CatalogOption[] {
  return (rows ?? []).map((row) => ({
    value: String(row[uuidField] ?? ''),
    label: String(row.Name ?? ''),
    code: String(row.Code ?? ''),
    isDefault: Number(row.IsDefault ?? 0) === 1,
  }));
}

@Component({
  selector: 'app-bug-report-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MnsSearchSelectFieldComponent,
    TranslocoPipe,
  ],
  templateUrl: './bug-report-dialog.html',
  styleUrls: ['./bug-report-dialog.scss'],
})
export class BugReportDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<BugReportDialogComponent>);
  private readonly bugReports = inject(BugReportService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly api = inject(ApiService);
  readonly data = inject<BugReportDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  readonly titleMax = 160;
  readonly descriptionMax = 10000;

  /** Ticket types and priorities come from the platform support desk catalogs. */
  readonly catalogs = resource({
    loader: async () => {
      const [types, priorities] = await Promise.all([
        this.api.get<{ data?: { items?: CatalogRow[] } }>('help/ticket-types'),
        this.api.get<{ data?: { items?: CatalogRow[] } }>('help/ticket-priorities'),
      ]);
      return {
        types: catalogOptions(types?.data?.items, 'SupportTicketTypeUUID'),
        priorities: catalogOptions(priorities?.data?.items, 'SupportTicketPriorityUUID'),
      };
    },
  });
  readonly typeOptions = computed(() => this.catalogs.value()?.types ?? []);
  readonly priorityOptions = computed(() => this.catalogs.value()?.priorities ?? []);
  /** Tickets belong to an environment: without one selected, the catalogs cannot load. */
  readonly unavailable = computed(() => this.catalogs.status() === 'error');

  readonly draft = this.bugReports.draft;
  readonly screenshot = signal<string | null>(null);
  readonly capturing = signal(true);
  readonly submitting = signal(false);
  readonly created = signal<BugReportCreated | null>(null);
  readonly environment = this.bugReports.environment();
  readonly diagnostics = this.bugReports.diagnosticsSnapshot();

  readonly isFormValid = computed(() => {
    const draft = this.draft();
    return (
      !this.unavailable() &&
      draft.title.trim().length > 0 &&
      draft.title.trim().length <= this.titleMax &&
      draft.description.trim().length > 0 &&
      draft.description.trim().length <= this.descriptionMax
    );
  });

  constructor() {
    // The dialog lives in the CDK overlay, which the capture ignores: the print shows the page.
    void this.capture();
    // Preselect: prefill codes (failed call), then the draft, then the desk defaults.
    effect(() => {
      const types = this.typeOptions();
      const priorities = this.priorityOptions();
      if (!types.length && !priorities.length) return;
      const codes = this.bugReports.prefillCodes();
      const draft = this.draft();
      const pick = (options: CatalogOption[], current: string, code?: string) =>
        options.find((option) => code && option.code === code)?.value ??
        options.find((option) => option.value === current)?.value ??
        options.find((option) => option.isDefault)?.value ??
        options[0]?.value ??
        '';
      const typeUUID = String(pick(types, draft.typeUUID, codes.typeCode));
      const priorityUUID = String(pick(priorities, draft.priorityUUID, codes.priorityCode));
      if (typeUUID !== draft.typeUUID || priorityUUID !== draft.priorityUUID) {
        this.draft.update((value) => ({ ...value, typeUUID, priorityUUID }));
      }
    });
  }

  successTitle(protocol: string): string {
    return this.transloco.translate('Ticket #{{protocol}} opened.', { protocol });
  }

  diagnosticsSummary(): string {
    return this.transloco.translate('{{errors}} console errors and {{requests}} failed requests', {
      errors: this.diagnostics.consoleLogs.length,
      requests: this.diagnostics.failedRequests.length,
    });
  }

  /** Exactly what will be sent, so the user can review it before submitting. */
  diagnosticsPreview(): string {
    const requests = this.diagnostics.failedRequests.map((entry) =>
      [
        entry.method,
        entry.url,
        `→ ${entry.status}`,
        entry.requestId ? `(${entry.requestId})` : '',
        entry.message ?? '',
      ]
        .filter(Boolean)
        .join(' '),
    );
    const errors = this.diagnostics.consoleLogs.map(
      (entry) => `[${entry.type}] ${entry.message.split('\n')[0]}`,
    );
    return [...requests, ...errors].slice(-15).join('\n');
  }

  update<K extends 'title' | 'description'>(key: K, value: string) {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  setType(value: unknown) {
    this.bugReports.prefillCodes.update((codes) => ({ ...codes, typeCode: undefined }));
    this.draft.update((draft) => ({ ...draft, typeUUID: String(value ?? '') }));
  }

  setPriority(value: unknown) {
    this.bugReports.prefillCodes.update((codes) => ({ ...codes, priorityCode: undefined }));
    this.draft.update((draft) => ({ ...draft, priorityUUID: String(value ?? '') }));
  }

  setIncludeDiagnostics(value: boolean) {
    this.draft.update((draft) => ({ ...draft, includeDiagnostics: value }));
  }

  removeScreenshot() {
    this.screenshot.set(null);
  }

  async capture() {
    this.capturing.set(true);
    try {
      this.screenshot.set(await this.bugReports.captureScreen());
    } finally {
      this.capturing.set(false);
    }
  }

  async submit() {
    if (!this.isFormValid() || this.submitting()) return;
    this.submitting.set(true);
    const draft = this.draft();
    const include = draft.includeDiagnostics;
    try {
      const created = await this.bugReports.submitReport({
        title: draft.title.trim(),
        description: draft.description.trim(),
        typeUUID: draft.typeUUID || null,
        priorityUUID: draft.priorityUUID || null,
        url: this.environment.url,
        route: this.environment.route,
        appVersion: this.environment.appVersion,
        screenshot: this.screenshot() ?? undefined,
        systemInfo: {
          userAgent: this.environment.userAgent,
          viewport: this.environment.viewport,
          language: this.environment.language,
          timezone: this.environment.timezone,
          platform: this.environment.platform,
          consoleLogs: include ? this.diagnostics.consoleLogs : [],
          failedRequests: include ? this.diagnostics.failedRequests : [],
          navigation: include ? this.diagnostics.navigation : [],
        },
      });
      this.created.set(created);
    } catch {
      // The API interceptor already shows the error; the draft stays for a retry.
    } finally {
      this.submitting.set(false);
    }
  }

  openMyTickets() {
    const ticket = this.created()?.SupportTicketUUID;
    this.dialogRef.close(true);
    void this.router.navigate(['/help/tickets'], ticket ? { queryParams: { ticket } } : {});
  }

  close() {
    this.dialogRef.close(Boolean(this.created()));
  }
}
