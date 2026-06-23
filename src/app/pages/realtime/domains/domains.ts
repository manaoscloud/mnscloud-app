import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { form as createForm, required, type Field as SignalField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { DateTimeFormatService } from '../../../services/date-time-format.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { bindDialogClosed } from '../../../shared/dialog/dialog-events.util';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import {
  MnsSelectFieldComponent,
  MnsStatusSelectFieldComponent,
  MnsTextFieldComponent,
  MnsTextareaFieldComponent,
  type MnsSelectFieldOption,
} from '../../../shared/forms';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { RealtimeDomainRecord, RealtimeDomainsService } from './domains.service';

type FieldType = 'text' | 'select' | 'textarea';
type Field = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  span?: string;
  rows?: number;
  options?: { value: string | number; label: string }[];
};
type SignalFormField = SignalField<any, any>;
type RealtimeDomainFormModel = {
  status: number;
  name: string;
  purpose: string;
  notes: string;
};

const STATUS_OPTIONS = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const PURPOSE_OPTIONS = [
  { value: 'turn', label: 'TURN/STUN' },
  { value: 'webrtc', label: 'WebRTC' },
  { value: 'media', label: 'Media/RTP' },
  { value: 'sfu', label: 'SFU' },
  { value: 'signaling', label: 'Signaling' },
  { value: 'chat', label: 'Chat' },
  { value: 'mixed', label: 'Mixed' },
];

const PURPOSE_LABELS = Object.fromEntries(PURPOSE_OPTIONS.map((option) => [option.value, option.label]));

const RECORD_FIELDS: Field[] = [
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
  { key: 'name', label: 'Domain', required: true },
  { key: 'purpose', label: 'Purpose', type: 'select', required: true, options: PURPOSE_OPTIONS },
];

const NOTES_FIELDS: Field[] = [
  { key: 'notes', label: 'Notes', type: 'textarea', span: 'span-4', rows: 8 },
];

@Component({
  selector: 'app-realtime-domains',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    MnsSelectFieldComponent,
    MnsStatusSelectFieldComponent,
    MnsTextFieldComponent,
    MnsTextareaFieldComponent,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './domains.html',
  styleUrls: ['./domains.scss'],
})
export class RealtimeDomainsPage {
  private readonly api = inject(RealtimeDomainsService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dateTime = inject(DateTimeFormatService);
  private readonly i18n = inject(TranslocoService);
  private readonly snack = inject(SnackbarService);

  readonly searchInput = signal('');
  readonly statusInput = signal('');
  private readonly appliedSearch = signal('');
  private readonly appliedStatus = signal('');
  readonly sortActive = signal('');
  readonly sortDirection = signal<Sort['direction']>('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  readonly saving = signal(false);
  readonly mutating = signal(false);
  readonly editing = signal<RealtimeDomainRecord | null>(null);
  readonly selected = signal<Set<string>>(new Set());
  readonly formModel = signal<RealtimeDomainFormModel>(this.defaultFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    required(schema.purpose);
  });
  readonly displayedColumns = [
    'select',
    'name',
    'purpose',
    'status',
    'updatedAt',
    'actions',
  ];

  readonly recordFields = RECORD_FIELDS;
  readonly notesFields = NOTES_FIELDS;
  readonly statusFilterOptions = signal([
    { value: '', label: 'All' },
    { value: '1', label: 'Active' },
    { value: '0', label: 'Inactive' },
  ]);
  readonly domainFormDialog = viewChild<TemplateRef<unknown>>('domainFormDialog');

  private dialogRef: MatDialogRef<unknown> | null = null;
  private binding: CrudDialogBinding | null = null;

  private readonly itemsResource = resource({
    params: () => ({ search: this.appliedSearch(), status: this.appliedStatus() }),
    defaultValue: [] as RealtimeDomainRecord[],
    loader: async ({ params }) => {
      const status = params.status === '' ? undefined : Number(params.status);
      const response = await this.api.list({ limit: 5000, search: params.search, status });
      return response?.data?.items ?? [];
    },
  });

  readonly rows = computed(() => this.itemsResource.value());
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly visibleRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly allVisibleSelected = computed(() => {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.selected().has(this.uuid(row)));
  });
  readonly someVisibleSelected = computed(() => {
    const rows = this.visibleRows();
    return rows.some((row) => this.selected().has(this.uuid(row))) && !this.allVisibleSelected();
  });
  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());

  private readonly syncRows = effect(() => {
    this.rows();
    this.reconcileSelection();
  });

  private readonly reportLoadError = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load realtime domains.'));
  });

  private readonly cleanup = this.destroyRef.onDestroy(() => this.closeDialog());

  refreshList(): void {
    this.itemsResource.reload();
  }

  applySearchFilters(): void {
    const nextSearch = this.searchInput().trim();
    const nextStatus = this.statusInput();
    this.pageIndex.set(0);
    if (nextSearch === this.appliedSearch() && nextStatus === this.appliedStatus()) {
      this.itemsResource.reload();
    } else {
      this.appliedSearch.set(nextSearch);
      this.appliedStatus.set(nextStatus);
    }
  }

  clearSearchFilters(): void {
    this.searchInput.set('');
    this.statusInput.set('');
    this.pageIndex.set(0);
    if (this.appliedSearch() || this.appliedStatus()) {
      this.appliedSearch.set('');
      this.appliedStatus.set('');
    } else {
      this.itemsResource.reload();
    }
  }

  setSort(sort: Sort): void {
    this.sortActive.set(sort.active || '');
    this.sortDirection.set(sort.direction || '');
    this.pageIndex.set(0);
  }

  setPage(page: PageEvent): void {
    this.pageIndex.set(page.pageIndex);
    this.pageSize.set(page.pageSize);
  }

  uuid(row: RealtimeDomainRecord): string {
    return String(row['RtdUUID'] ?? '');
  }

  name(row: RealtimeDomainRecord): string {
    return String(row['RtdName'] ?? '');
  }

  status(row: RealtimeDomainRecord): boolean {
    return Number(row['RtdStatus'] ?? 0) === 1;
  }

  columnLabel(column: string): string {
    const labels: Record<string, string> = {
      name: 'Domain',
      purpose: 'Purpose',
      status: 'Status',
      updatedAt: 'Updated',
    };
    return labels[column] ?? column;
  }

  cell(row: RealtimeDomainRecord, column: string): string {
    const map: Record<string, any> = {
      name: row['RtdName'],
      purpose: this.optionLabel(PURPOSE_LABELS, row['RtdPurpose']),
      status: this.status(row) ? 'Active' : 'Inactive',
      updatedAt: this.dateTime.formatDateTime(row['RtdDateUpdated'] ?? row['RtdDateCreated']),
    };
    return String(map[column] ?? '');
  }

  isTranslatedColumn(column: string): boolean {
    return ['purpose'].includes(column);
  }

  isSelected(row: RealtimeDomainRecord): boolean {
    return this.selected().has(this.uuid(row));
  }

  toggle(row: RealtimeDomainRecord, checked: boolean): void {
    const next = new Set(this.selected());
    checked ? next.add(this.uuid(row)) : next.delete(this.uuid(row));
    this.selected.set(next);
  }

  toggleVisible(checked: boolean): void {
    const next = new Set(this.selected());
    for (const row of this.visibleRows()) {
      checked ? next.add(this.uuid(row)) : next.delete(this.uuid(row));
    }
    this.selected.set(next);
  }

  formField(key: keyof RealtimeDomainFormModel | string): SignalFormField {
    return (this.form as any)[key];
  }

  selectOptions(field: Field): MnsSelectFieldOption[] {
    return field.options ?? [];
  }

  startCreate(): void {
    this.editing.set(null);
    this.formModel.set(this.defaultFormModel());
    this.openDialog();
  }

  startEdit(row: RealtimeDomainRecord): void {
    this.editing.set(row);
    this.formModel.set(this.formModelFromRow(row));
    this.openDialog();
  }

  async submit(saveAndNew = false): Promise<void> {
    if (!this.isFormValid()) return;
    this.saving.set(true);
    try {
      const row = this.editing();
      if (row) {
        await this.api.update(this.uuid(row), this.payload());
      } else {
        await this.api.create(this.payload());
      }
      this.snack.success(this.t('Realtime domain saved.'));
      this.itemsResource.reload();
      if (saveAndNew && !row) {
        this.editing.set(null);
        this.formModel.set(this.defaultFormModel());
      } else {
        this.closeDialog();
      }
    } catch (error: any) {
      this.snack.error(this.errorMessage(error, this.t('Failed to save realtime domain.')));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(row: RealtimeDomainRecord): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: this.t('Delete realtime domain'),
            message: this.t('Delete realtime domain confirmation', { name: this.name(row) }),
            confirmText: this.t('Delete'),
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.api.remove(this.uuid(row));
    this.snack.success(this.t('Realtime domain deleted.'));
    this.itemsResource.reload();
  }

  async removeSelected(): Promise<void> {
    const ids = [...this.selected()];
    if (!ids.length) return;
    const ok = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: this.t('Delete selected realtime domains'),
            message: this.t('Delete selected realtime domains confirmation', { count: ids.length }),
            confirmText: this.t('Delete selected'),
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    const result = await this.api.removeMany(ids);
    const failed = result?.data?.failed ?? [];
    const failedIds = new Set<string>(
      failed.map((item: Record<string, string>) => item['RtdUUID']).filter(Boolean),
    );
    this.selected.set(failedIds);
    if (failed.length) {
      this.snack.error(this.t('Selected realtime domains could not be deleted.', { count: failed.length }));
    } else {
      this.snack.success(this.t('Selected realtime domains deleted.'));
    }
    this.itemsResource.reload();
  }

  closeDialog(): void {
    this.dialogRef?.close();
    this.dialogRef = null;
    this.binding?.stop();
    this.binding = null;
    this.saving.set(false);
  }

  private openDialog(): void {
    const dialog = this.domainFormDialog();
    if (!dialog) return;
    this.binding = openCrudTemplateDialog(this.dialog, dialog, 'realtime-domain-form-dialog', {
      onEscape: () => this.closeDialog(),
    });
    this.dialogRef = this.binding.ref;
    bindDialogClosed(this.dialogRef, () => {
      this.binding?.stop();
      this.binding = null;
      this.dialogRef = null;
      this.saving.set(false);
    });
  }

  private defaultFormModel(): RealtimeDomainFormModel {
    return {
      status: 1,
      name: '',
      purpose: 'turn',
      notes: '',
    };
  }

  private formModelFromRow(row: RealtimeDomainRecord): RealtimeDomainFormModel {
    return {
      status: Number(row['RtdStatus'] ?? 0) === 1 ? 1 : 0,
      name: row['RtdName'] ?? '',
      purpose: row['RtdPurpose'] ?? 'turn',
      notes: row['RtdNotes'] ?? '',
    };
  }

  private payload(): Record<string, any> {
    const model = this.formModel();
    return {
      name: String(model['name'] ?? '').trim(),
      purpose: model['purpose'],
      notes: String(model['notes'] ?? '').trim() || null,
      status: Number(model['status']) === 1 ? 1 : 0,
    };
  }

  private isFormValid(): boolean {
    return this.form().valid();
  }

  private reconcileSelection(): void {
    const valid = new Set(this.rows().map((row: RealtimeDomainRecord) => this.uuid(row)));
    const current = untracked(() => this.selected());
    const next = new Set([...current].filter((id) => valid.has(id)));
    if (next.size === current.size && [...next].every((id) => current.has(id))) return;
    this.selected.set(next);
  }

  private sortRows(rows: RealtimeDomainRecord[]): RealtimeDomainRecord[] {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    const multiplier = direction === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => {
      const leftValue =
        active === 'updatedAt'
          ? this.dateTime.toEpoch(left['RtdDateUpdated'] ?? left['RtdDateCreated'])
          : String(this.cell(left, active) ?? '').toLowerCase();
      const rightValue =
        active === 'updatedAt'
          ? this.dateTime.toEpoch(right['RtdDateUpdated'] ?? right['RtdDateCreated'])
          : String(this.cell(right, active) ?? '').toLowerCase();
      return (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0) * multiplier;
    });
  }

  private errorMessage(error: unknown, fallback: string): string {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.error || maybe?.error?.message || maybe?.message || fallback;
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.i18n.translate(key, params);
  }

  private optionLabel(options: Record<string, string>, value: unknown): string {
    const key = String(value ?? '');
    return options[key] ?? key;
  }
}
