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
import { toSignal } from '@angular/core/rxjs-interop';

import { FormField, form as createForm, pattern, required } from '@angular/forms/signals';

import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, takeUntil } from 'rxjs';

import { SnackbarService } from '../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { VoipDomainService, VoipDomainItem, VoipDomainScope } from './domain.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { bindDialogClosed } from '../../../shared/dialog/dialog-events.util';
import { createSignalCrudTable } from '../../../shared/crud/signal-crud-table';

const DOMAIN_REGEX = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

type DomainFilters = {
  search: string;
  scope: VoipDomainScope;
};

type DomainFormModel = {
  name: string;
  status: number;
};

@Component({
  selector: 'app-voip-domain',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
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
    TranslocoPipe,
  ],
  templateUrl: './domain.html',
  styleUrls: ['./domain.scss'],
})
export class VoipDomainPage {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipDomainService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipDomainItem | null>(null);
  readonly selectedDomainUUIDs = signal<Set<string>>(new Set());
  readonly scope = signal<VoipDomainScope>('tenant');

  readonly displayedColumns = ['select', 'name', 'status', 'actions'];
  readonly searchInput = signal('');
  readonly statusInput = signal('');
  private readonly appliedSearch = signal('');
  private readonly appliedStatus = signal('');
  private readonly domainsResource = resource({
    params: (): DomainFilters => ({
      search: this.appliedSearch(),
      scope: this.scope(),
    }),
    defaultValue: [] as VoipDomainItem[],
    loader: ({ params }) => this.fetchDomains(params),
  });
  readonly rows = computed(() => {
    const status = this.appliedStatus();
    return this.domainsResource
      .value()
      .filter((row) => status === '' || String(row.VdmStatus) === status);
  });
  readonly table = createSignalCrudTable(this.rows, (row, column) => this.sortValue(row, column));
  readonly sortActive = this.table.sortActive;
  readonly sortDirection = this.table.sortDirection;
  readonly pageIndex = this.table.pageIndex;
  readonly pageSize = this.table.pageSize;
  readonly sortedRows = this.table.sortedRows;
  readonly visibleRows = this.table.visibleRows;
  readonly loading = computed(() => this.domainsResource.isLoading() || this.deletingSelected());

  readonly statusOptions = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];
  readonly statusFilterOptions = [
    { value: '', label: 'All' },
    { value: '1', label: 'Active' },
    { value: '0', label: 'Inactive' },
  ];

  readonly formModel = signal<DomainFormModel>({
    name: '',
    status: 1,
  });

  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    pattern(schema.name, DOMAIN_REGEX);
  });

  readonly domainFormDialog = viewChild<TemplateRef<unknown>>('domainFormDialog');
  private domainFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly routeData = toSignal(this.route.data, { initialValue: {} });
  private readonly domainsEffect = effect(() => {
    this.rows();
    this.reconcileSelection();
  });
  private readonly domainsErrorEffect = effect(() => {
    const error = this.domainsResource.error();
    if (!error) return;
    const message = error instanceof Error ? error.message : 'Failed to load domains.';
    this.snack.error(message);
  });

  private readonly initializePage = effect(() => {
    const data = this.routeData() as Record<string, unknown>;
    untracked(() => {
      this.scope.set(data['scope'] === 'master' ? 'master' : 'tenant');
      this.domainsResource.reload();
    });
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeDomainDialog();
  });

  onSearchChange(value: string) {
    this.searchInput.set(value);
  }

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    const nextStatus = this.statusInput();
    this.table.resetPage();
    if (nextSearch === this.appliedSearch() && nextStatus === this.appliedStatus()) {
      this.domainsResource.reload();
    } else {
      this.appliedSearch.set(nextSearch);
      this.appliedStatus.set(nextStatus);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.statusInput.set('');
    this.table.resetPage();
    if (this.appliedSearch() || this.appliedStatus()) {
      this.appliedSearch.set('');
      this.appliedStatus.set('');
    } else {
      this.domainsResource.reload();
    }
  }

  refreshList() {
    this.domainsResource.reload();
  }

  selectedCount() {
    return this.selectedDomainUUIDs().size;
  }

  setSort(sort: Sort) {
    this.table.setSort(sort);
  }

  setPage(page: PageEvent) {
    this.table.setPage(page);
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

  private async fetchDomains(filters: DomainFilters): Promise<VoipDomainItem[]> {
    const response = await this.api.list(
      {
        search: filters.search || undefined,
        limit: this.listLimit,
      },
      filters.scope,
    );
    return response?.data?.items ?? [];
  }

  startCreate() {
    this.resetForm();
    this.openDomainDialog();
  }

  startEdit(item: VoipDomainItem) {
    this.editing.set(item);
    this.formModel.set({
      name: item.VdmName,
      status: item.VdmStatus,
    });
    this.openDomainDialog();
  }

  cancelEdit() {
    this.resetForm();
    this.closeDomainDialog();
  }

  submitDomainForm(event: Event) {
    event.preventDefault();
    void this.saveDomain();
  }

  async saveDomain(createAnother = false) {
    if (!this.form().valid()) {
      this.snack.warning('Please fill all required fields.');
      return;
    }

    const { name, status } = this.formModel();
    const payload = { name: name.trim(), status };
    if (!payload.name) return;

    this.saving.set(true);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VdmUUID, payload, this.scope());
        this.snack.success('VoIP domain updated.');
      } else {
        await this.api.create(payload, this.scope());
        this.snack.success('VoIP domain created.');
      }

      this.domainsResource.reload();
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
      await this.api.remove(item.VdmUUID, this.scope());
      this.toggleDomainSelection(item, false);
      this.domainsResource.reload();
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

    const selectedNames = this.rows()
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
      const response = await this.api.removeMany(ids, this.scope());
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      this.selectedDomainUUIDs.set(
        new Set([...this.selectedDomainUUIDs()].filter((uuid) => !deleted.has(uuid))),
      );
      this.domainsResource.reload();

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
    this.formModel.set({ name: '', status: 1 });
    this.editing.set(null);
  }

  private reconcileSelection() {
    const available = new Set(this.rows().map((item) => item.VdmUUID));
    const current = untracked(() => this.selectedDomainUUIDs());
    const next = new Set([...current].filter((uuid) => available.has(uuid)));
    if (next.size === current.size && [...next].every((uuid) => current.has(uuid))) return;
    this.selectedDomainUUIDs.set(next);
  }

  private openDomainDialog() {
    const domainFormDialog = this.domainFormDialog();
    if (!domainFormDialog || this.domainFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      domainFormDialog,
      'voip-domain-form-dialog',
    );
    this.domainFormDialogRef = this.dialogBinding.ref;
    bindDialogClosed(this.domainFormDialogRef, () => {
      this.cancelEdit();
    });
  }

  private closeDomainDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.domainFormDialogRef?.close();
    this.domainFormDialogRef = null;
  }

  statusLabel(status: number) {
    return status === 1 ? 'Active' : 'Inactive';
  }

  private sortValue(row: VoipDomainItem, column: string): string | number {
    switch (column) {
      case 'name':
        return row.VdmName ?? '';
      case 'status':
        return row.VdmStatus ?? 0;
      default:
        return '';
    }
  }
}
