import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, TemplateRef, ViewChild, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
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
import { firstValueFrom } from 'rxjs';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { VoipSoftswitchServerItem, VoipSoftswitchServerService } from './server.service';
import { TranslocoPipe } from '@jsverse/transloco';

type ServerPayload = {
  name: string;
  nodeUUID: string;
  engine: string;
  hostname: string;
  publicIP: string;
  privateIP: string;
  baseUrl: string;
  notes: string;
  status: number;
};

@Component({
  selector: 'app-voip-softswitch-server',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
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
    TranslocoPipe,
    MatTooltipModule,
  ],
  templateUrl: './server.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./server.scss'],
})
export class VoipSoftswitchServerPage implements AfterViewInit {
  private readonly api = inject(VoipSoftswitchServerService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(SnackbarService);

  readonly dataSource = new MatTableDataSource<VoipSoftswitchServerItem>([]);
  readonly displayedColumns = [
    'select',
    'name',
    'hostname',
    'publicIP',
    'privateIP',
    'engine',
    'status',
    'lastSeen',
    'actions',
  ];
  readonly editing = signal<VoipSoftswitchServerItem | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly selectedIds = signal<Set<string>>(new Set());

  search = '';
  searchInput = '';
  private dialogBinding: CrudDialogBinding | null = null;
  private dialogRef: MatDialogRef<unknown> | null = null;
  private minLoadingTimer: ReturnType<typeof setTimeout> | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    nodeUUID: [''],
    engine: ['kamailio', Validators.required],
    hostname: [''],
    publicIP: [''],
    privateIP: [''],
    baseUrl: [''],
    notes: [''],
    status: [1, Validators.required],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('formDialog') formDialog?: TemplateRef<unknown>;

  constructor() {
    this.dataSource.sortingDataAccessor = (row, column) => {
      switch (column) {
        case 'nodeUUID':
          return row.VsrNodeUUID || '';
        case 'name':
          return row.VsrName || '';
        case 'hostname':
          return row.VsrHostname || '';
        case 'publicIP':
          return row.VsrPublicIP || '';
        case 'privateIP':
          return row.VsrPrivateIP || '';
        case 'engine':
          return this.engineLabel(row.VsrEngine);
        case 'status':
          return this.statusLabel(row);
        case 'lastSeen':
          return row.VsrLastSeenAt || '';
        default:
          return '';
      }
    };

    void this.load();
  }

  ngAfterViewInit() {
    if (this.sort) this.dataSource.sort = this.sort;
    if (this.paginator) this.dataSource.paginator = this.paginator;
  }

  get selectedCount() {
    return this.selectedIds().size;
  }

  async refreshList() {
    await this.load();
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    if (this.paginator) this.paginator.firstPage();
    void this.load();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    if (this.paginator) this.paginator.firstPage();
    void this.load();
  }

  async load() {
    this.startLoading();
    try {
      const res = await this.api.list(true, { search: this.search, limit: 5000, offset: 0 });
      this.dataSource.data = res?.data?.items ?? [];
      this.reconcileSelection();
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to load Softswitch servers.');
    } finally {
      this.stopLoading();
    }
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset(this.emptyFormValue());
    this.openDialog();
  }

  startEdit(row: VoipSoftswitchServerItem) {
    this.editing.set(row);
    this.form.reset({
      name: row.VsrName || '',
      nodeUUID: row.VsrNodeUUID || '',
      engine: row.VsrEngine || 'kamailio',
      hostname: row.VsrHostname || '',
      publicIP: row.VsrPublicIP || '',
      privateIP: row.VsrPrivateIP || '',
      baseUrl: row.VsrBaseUrl || '',
      notes: row.VsrNotes || '',
      status: Number(row.VsrStatus ?? 1),
    });
    this.openDialog();
  }

  async save(createAnother = false) {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const payload = this.normalizedPayload();
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VsrUUID, payload, true);
        this.snack.success('Softswitch server updated successfully.');
      } else {
        await this.api.create(payload, true);
        this.snack.success('Softswitch server created successfully.');
      }

      await this.load();
      if (createAnother && !editing) {
        this.form.reset(this.emptyFormValue());
        return;
      }
      this.closeDialog();
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to save Softswitch server.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(row: VoipSoftswitchServerItem) {
    const confirmed = await this.confirmDelete(
      'Delete Softswitch server',
      `Delete "${row.VsrName}"? This action will disable the server record.`,
    );
    if (!confirmed) return;

    try {
      await this.api.remove(row.VsrUUID, true);
      this.removeSelection([row.VsrUUID]);
      this.snack.success('Softswitch server deleted successfully.');
      await this.load();
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to delete Softswitch server.');
    }
  }

  async removeSelectedServers() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const labels = this.dataSource.data
      .filter((row) => this.selectedIds().has(row.VsrUUID))
      .slice(0, 3)
      .map((row) => row.VsrName)
      .join(', ');
    const confirmed = await this.confirmDelete(
      'Delete selected Softswitch servers',
      `Delete ${ids.length} selected server${ids.length === 1 ? '' : 's'}${
        labels ? ` (${labels}${ids.length > 3 ? ', ...' : ''})` : ''
      }?`,
    );
    if (!confirmed) return;

    try {
      const res = await this.api.removeMany(ids, true);
      const deleted = this.extractDeletedIds(res, ids);
      const failed = this.extractFailedIds(res);
      this.removeSelection(deleted);
      if (failed.length) this.keepSelection(failed);
      this.snack.success(
        failed.length
          ? `${deleted.length} server(s) deleted. ${failed.length} failed.`
          : 'Selected Softswitch servers deleted successfully.',
      );
      await this.load();
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to delete selected Softswitch servers.');
    }
  }

  isSelected(row: VoipSoftswitchServerItem) {
    return this.selectedIds().has(row.VsrUUID);
  }

  toggleServerSelection(row: VoipSoftswitchServerItem, checked: boolean) {
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(row.VsrUUID);
    } else {
      next.delete(row.VsrUUID);
    }
    this.selectedIds.set(next);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.selectedIds().has(row.VsrUUID));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.selectedIds().has(row.VsrUUID)) && !this.isAllVisibleSelected();
  }

  toggleVisibleSelection(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const row of this.visibleRows()) {
      if (checked) {
        next.add(row.VsrUUID);
      } else {
        next.delete(row.VsrUUID);
      }
    }
    this.selectedIds.set(next);
  }

  engineLabel(engine?: string | null) {
    if (engine === 'kamailio') return 'Kamailio';
    if (engine === 'opensips') return 'OpenSIPS';
    return engine || '-';
  }

  statusLabel(row: VoipSoftswitchServerItem) {
    return Number(row.VsrStatus) === 1 ? 'ACTIVE' : 'INACTIVE';
  }

  closeDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.dialogRef?.close();
    this.dialogRef = null;
  }

  private openDialog() {
    if (!this.formDialog || this.dialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.formDialog,
      'voip-softswitch-server-dialog',
      { onEscape: () => this.closeDialog() },
    );
    this.dialogRef = this.dialogBinding.ref;
  }

  private emptyFormValue(): ServerPayload {
    return {
      name: '',
      nodeUUID: '',
      engine: 'kamailio',
      hostname: '',
      publicIP: '',
      privateIP: '',
      baseUrl: '',
      notes: '',
      status: 1,
    };
  }

  private normalizedPayload(): ServerPayload {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      nodeUUID: value.nodeUUID.trim(),
      engine: value.engine,
      hostname: value.hostname.trim(),
      publicIP: value.publicIP.trim(),
      privateIP: value.privateIP.trim(),
      baseUrl: value.baseUrl.trim(),
      notes: value.notes.trim(),
      status: Number(value.status),
    };
  }

  private visibleRows() {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    if (!this.paginator) return rows;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return rows.slice(start, start + this.paginator.pageSize);
  }

  private reconcileSelection() {
    const existing = new Set(this.dataSource.data.map((row) => row.VsrUUID));
    this.selectedIds.set(new Set([...this.selectedIds()].filter((id) => existing.has(id))));
  }

  private removeSelection(ids: string[]) {
    const next = new Set(this.selectedIds());
    for (const id of ids) next.delete(id);
    this.selectedIds.set(next);
  }

  private keepSelection(ids: string[]) {
    this.selectedIds.set(new Set(ids));
  }

  private extractDeletedIds(response: any, fallback: string[]) {
    const deleted = response?.data?.deleted ?? response?.deleted;
    return Array.isArray(deleted) ? deleted : fallback;
  }

  private extractFailedIds(response: any) {
    const failed = response?.data?.failed ?? response?.failed;
    if (!Array.isArray(failed)) return [];
    return failed
      .map((item: any) => item?.VsrUUID || item?.uuid || item?.id)
      .filter((id: unknown): id is string => typeof id === 'string' && !!id);
  }

  private async confirmDelete(title: string, message: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title, message, confirmLabel: 'Delete' },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  private startLoading() {
    if (this.minLoadingTimer) clearTimeout(this.minLoadingTimer);
    this.loading.set(true);
  }

  private stopLoading() {
    if (this.minLoadingTimer) clearTimeout(this.minLoadingTimer);
    this.minLoadingTimer = setTimeout(() => {
      this.loading.set(false);
      this.minLoadingTimer = null;
    }, 600);
  }
}
