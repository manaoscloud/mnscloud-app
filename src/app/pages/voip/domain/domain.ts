import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../shared/animations/fade.animation';
import { SnackbarService } from '../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { VoipDomainService, VoipDomainItem } from './domain.service';

const DOMAIN_REGEX = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

@Component({
  selector: 'app-voip-domain',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatMenuModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatTabsModule,
  ],
  templateUrl: './domain.html',
  styleUrls: ['./domain.scss'],
  animations: [fadeIn],
})
export class VoipDomainPage implements AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipDomainService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipDomainItem | null>(null);
  readonly selectedDomainUUIDs = signal<Set<string>>(new Set());

  readonly dataSource = new MatTableDataSource<VoipDomainItem>([]);
  readonly displayedColumns = ['select', 'name', 'status', 'actions'];
  search = '';
  searchInput = '';

  readonly statusOptions = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(DOMAIN_REGEX)]],
    status: [1],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('domainFormDialog') domainFormDialog?: TemplateRef<unknown>;
  private domainFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.VdmName ?? '';
        case 'status':
          return data.VdmStatus ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      const statusLabel = data.VdmStatus === 1 ? 'active' : 'inactive';
      return [data.VdmName, statusLabel]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => void this.loadDomains(), 0);
  }

  ngOnDestroy() {
    this.closeDomainDialog();
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    void this.loadDomains();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    void this.loadDomains();
  }

  refreshList() {
    void this.loadDomains();
  }

  selectedCount() {
    return this.selectedDomainUUIDs().size;
  }

  visibleRows() {
    const rows = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return rows;

    const start = paginator.pageIndex * paginator.pageSize;
    return rows.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipDomainItem) {
    return this.selectedDomainUUIDs().has(item.VdmUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleDomainSelection(item: VoipDomainItem, checked: boolean) {
    const next = new Set(this.selectedDomainUUIDs());
    if (checked) {
      next.add(item.VdmUUID);
    } else {
      next.delete(item.VdmUUID);
    }
    this.selectedDomainUUIDs.set(next);
  }

  toggleVisibleSelection(checked: boolean) {
    const rows = this.visibleRows();
    const next = new Set(this.selectedDomainUUIDs());

    for (const row of rows) {
      if (checked) {
        next.add(row.VdmUUID);
      } else {
        next.delete(row.VdmUUID);
      }
    }

    this.selectedDomainUUIDs.set(next);
  }

  async loadDomains() {
    this.loading.set(true);
    const start = performance.now();

    try {
      const response = await this.api.list({
        search: this.search || undefined,
        limit: this.listLimit,
      });
      this.dataSource.data = response?.data?.items ?? [];
      this.reconcileSelection();
      this.dataSource.filter = '';
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    } catch (err: any) {
      const message =
        err?.error?.message || err?.error?.error || err?.message || 'Failed to load domains.';
      this.snack.error(message);
      this.dataSource.data = [];
    } finally {
      const elapsed = performance.now() - start;
      const minMs = 600;
      const waitMs = Math.max(0, minMs - elapsed);
      if (waitMs) {
        setTimeout(() => this.loading.set(false), waitMs);
      } else {
        this.loading.set(false);
      }
    }
  }

  startCreate() {
    this.resetForm();
    this.openDomainDialog();
  }

  startEdit(item: VoipDomainItem) {
    this.editing.set(item);
    this.form.patchValue({
      name: item.VdmName,
      status: item.VdmStatus,
    });
    this.openDomainDialog();
  }

  cancelEdit() {
    this.resetForm();
    this.closeDomainDialog();
  }

  async saveDomain(createAnother = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.warning('Please fill all required fields.');
      return;
    }

    const { name, status } = this.form.getRawValue();
    const payload = { name: name.trim(), status };
    if (!payload.name) return;

    this.saving.set(true);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VdmUUID, payload);
        this.snack.success('VoIP domain updated.');
      } else {
        await this.api.create(payload);
        this.snack.success('VoIP domain created.');
      }

      await this.loadDomains();
      if (createAnother && !editing) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      const message =
        err?.error?.message || err?.error?.error || err?.message || 'Failed to save domain.';
      this.snack.error(message);
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewDomain() {
    void this.saveDomain(true);
  }

  async removeDomain(item: VoipDomainItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Domain',
        message: `Are you sure you want to delete "${item.VdmName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.remove(item.VdmUUID);
      this.dataSource.data = this.dataSource.data.filter((row) => row.VdmUUID !== item.VdmUUID);
      this.toggleDomainSelection(item, false);
      this.snack.success('VoIP domain deleted.');
    } catch (err: any) {
      const message =
        err?.error?.message || err?.error?.error || err?.message || 'Failed to delete domain.';
      this.snack.error(message);
    }
  }

  async removeSelectedDomains() {
    const ids = [...this.selectedDomainUUIDs()];
    if (!ids.length) return;

    const selectedNames = this.dataSource.data
      .filter((item) => this.selectedDomainUUIDs().has(item.VdmUUID))
      .slice(0, 3)
      .map((item) => item.VdmName)
      .join(', ');

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected domains',
        message: `Are you sure you want to delete ${ids.length} selected domain${ids.length === 1 ? '' : 's'}${selectedNames ? ` (${selectedNames}${ids.length > 3 ? ', ...' : ''})` : ''}?`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingSelected.set(true);

    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VdmUUID));
      this.selectedDomainUUIDs.set(
        new Set([...this.selectedDomainUUIDs()].filter((uuid) => !deleted.has(uuid))),
      );

      const failed = response?.data?.failed ?? [];
      if (failed.length) {
        this.snack.error(`${deleted.size} domains deleted. ${failed.length} domains failed.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} VoIP domain(s) deleted.`);
      }
    } catch (err: any) {
      const message =
        err?.error?.message ||
        err?.error?.error ||
        err?.message ||
        'Failed to delete selected domains.';
      this.snack.error(message);
    } finally {
      this.deletingSelected.set(false);
    }
  }

  private resetForm() {
    this.form.reset({ name: '', status: 1 });
    this.editing.set(null);
  }

  private reconcileSelection() {
    const available = new Set(this.dataSource.data.map((item) => item.VdmUUID));
    const next = new Set([...this.selectedDomainUUIDs()].filter((uuid) => available.has(uuid)));
    this.selectedDomainUUIDs.set(next);
  }

  private openDomainDialog() {
    if (!this.domainFormDialog || this.domainFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.domainFormDialog,
      'voip-domain-form-dialog',
    );
    this.domainFormDialogRef = this.dialogBinding.ref;
    this.domainFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelEdit();
    });
  }

  private closeDomainDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.domainFormDialogRef?.close();
    this.domainFormDialogRef = null;
  }
}
