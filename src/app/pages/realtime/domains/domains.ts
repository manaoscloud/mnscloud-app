import {
  Component,
  DestroyRef,
  TemplateRef,
  afterNextRender,
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
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
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
  private readonly appliedSearch = signal('');
  readonly saving = signal(false);
  readonly mutating = signal(false);
  readonly editing = signal<RealtimeDomainRecord | null>(null);
  readonly selected = signal<Set<string>>(new Set());
  readonly formModel = signal<RealtimeDomainFormModel>(this.defaultFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    required(schema.purpose);
  });
  readonly dataSource = new MatTableDataSource<RealtimeDomainRecord>([]);
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
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly domainFormDialog = viewChild<TemplateRef<unknown>>('domainFormDialog');

  private dialogRef: MatDialogRef<unknown> | null = null;
  private binding: CrudDialogBinding | null = null;

  private readonly itemsResource = resource({
    params: () => this.appliedSearch(),
    defaultValue: [] as RealtimeDomainRecord[],
    loader: async ({ params }) => {
      const response = await this.api.list({ limit: 5000, search: params });
      return response?.data?.items ?? [];
    },
  });

  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => {
      if (column === 'updatedAt') {
        return this.dateTime.toEpoch(row['RtdDateUpdated'] ?? row['RtdDateCreated']);
      }
      return String(this.cell(row, column) ?? '').toLowerCase();
    };
  });

  private readonly syncRows = effect(() => {
    this.dataSource.data = this.itemsResource.value();
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
    this.appliedSearch.set(this.searchInput().trim());
    this.paginator()?.firstPage();
  }

  clearSearchFilters(): void {
    this.searchInput.set('');
    this.appliedSearch.set('');
    this.paginator()?.firstPage();
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

  visibleRows(): RealtimeDomainRecord[] {
    const rows = this.dataSource.filteredData;
    const paginator = this.paginator();
    if (!paginator) return rows;
    const start = paginator.pageIndex * paginator.pageSize;
    return rows.slice(start, start + paginator.pageSize);
  }

  allVisibleSelected(): boolean {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.selected().has(this.uuid(row)));
  }

  someVisibleSelected(): boolean {
    const rows = this.visibleRows();
    return rows.some((row) => this.selected().has(this.uuid(row))) && !this.allVisibleSelected();
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
    const valid = new Set(this.dataSource.data.map((row) => this.uuid(row)));
    const current = untracked(() => this.selected());
    const next = new Set([...current].filter((id) => valid.has(id)));
    if (next.size === current.size && [...next].every((id) => current.has(id))) return;
    this.selected.set(next);
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
