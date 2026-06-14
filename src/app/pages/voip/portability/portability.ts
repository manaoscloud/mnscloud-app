import {
  Component,
  TemplateRef,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';

import { FormField, form as createForm, pattern, required } from '@angular/forms/signals';

import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom, takeUntil } from 'rxjs';

import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { DateMaskDirective } from '../../../shared/date-mask/date-mask.directive';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { VoipPortabilityService, VoipPortabilityItem } from './portability.service';
import { VoipDidOperatorService, VoipDidOperatorItem } from '../did/operator/operator.service';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type OperatorOption = { value: string; label: string };
type CustomerOption = { value: string; label: string };

type CustomerItem = {
  CustomerUUID: string;
  Name: string;
  Document?: string | null;
};

type PortabilityFilters = {
  search: string;
};
type PortabilityFormModel = {
  customerUUID: string;
  number: string;
  direction: string;
  donorOperatorUUID: string;
  recipientOperatorUUID: string;
  status: string;
  requestedAt: Date | null;
  scheduledAt: Date | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  reason: string;
  notes: string;
};

@Component({
  selector: 'app-voip-portability',
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
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatMenuModule,
    DateMaskDirective,
    PhoneInputComponent,
  ],
  templateUrl: './portability.html',
  styleUrls: ['./portability.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoipPortabilityPage {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipPortabilityService);
  private readonly operatorApi = inject(VoipDidOperatorService);
  private readonly customerApi = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<VoipPortabilityItem | null>(null);

  readonly operators = signal<OperatorOption[]>([]);
  readonly operatorMap = signal<Map<string, VoipDidOperatorItem>>(new Map());
  readonly customers = signal<CustomerOption[]>([]);
  readonly customerMap = signal<Map<string, CustomerItem>>(new Map());
  readonly customerSearch = signal('');
  readonly donorSearch = signal('');
  readonly recipientSearch = signal('');
  readonly search = signal('');
  readonly searchInput = signal('');
  private readonly appliedSearch = signal('');
  private readonly portabilityResource = resource({
    params: (): PortabilityFilters => ({
      search: this.appliedSearch(),
    }),
    defaultValue: [] as VoipPortabilityItem[],
    loader: ({ params }) => this.fetchPortability(params),
  });
  readonly loading = this.portabilityResource.isLoading;

  readonly dataSource = new MatTableDataSource<VoipPortabilityItem>([]);
  readonly displayedColumns = [
    'select',
    'number',
    'direction',
    'status',
    'customer',
    'operators',
    'ticket',
    'requestedAt',
    'actions',
  ];

  readonly statusOptions = [
    { value: 'requested', label: 'Requested' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  readonly directionOptions = [
    { value: 'port_in', label: 'Port In' },
    { value: 'port_out', label: 'Port Out' },
  ];

  readonly formModel = signal<PortabilityFormModel>(this.emptyFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.customerUUID);
    required(schema.number);
    pattern(schema.number, /^\d{8,15}$/);
    required(schema.direction);
    required(schema.donorOperatorUUID);
    required(schema.recipientOperatorUUID);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly portabilityFormDialog = viewChild<TemplateRef<unknown>>('portabilityFormDialog');
  private portabilityFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly portabilityEffect = effect(() => {
    this.dataSource.data = this.portabilityResource.value();
    this.reconcileSelection();
    this.dataSource.filter = '';
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  });
  private readonly portabilityErrorEffect = effect(() => {
    const error = this.portabilityResource.error();
    if (!error) return;
    const message = this.extractErrorMessage(error, 'Failed to load portability records.');
    this.error.set(message);
    this.snack.error(message);
    this.dataSource.data = [];
  });

  private readonly afterViewReady = afterNextRender(async () => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'number':
          return data.Number ?? '';
        case 'direction':
          return this.directionLabel(data.Direction);
        case 'status':
          return this.statusLabel(data.Status);
        case 'customer':
          return this.customerLabel(data.CustomerCusUUID).toLowerCase();
        case 'operators':
          return `${this.operatorLabel(data.DonorVoipDidOperatorVdoUUID)} ${this.operatorLabel(data.RecipientVoipDidOperatorVdoUUID)}`.toLowerCase();
        case 'ticket':
          return this.ticketLabel(data);
        case 'requestedAt':
          return data.RequestedAt ?? '';
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      const customerLabel = this.customerLabel(data.CustomerCusUUID).toLowerCase();
      const donorLabel = this.operatorLabel(data.DonorVoipDidOperatorVdoUUID).toLowerCase();
      const recipientLabel = this.operatorLabel(data.RecipientVoipDidOperatorVdoUUID).toLowerCase();
      return [
        data.Number,
        data.Direction,
        data.Status,
        customerLabel,
        donorLabel,
        recipientLabel,
        data.SupportTicketID,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    void this.refresh();
  
  });

  onSearchChange(value: string) {
    this.searchInput.set(value);
  }

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    this.search.set(nextSearch);
    if (nextSearch === this.appliedSearch()) {
      this.portabilityResource.reload();
    } else {
      this.appliedSearch.set(nextSearch);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    if (this.appliedSearch()) {
      this.appliedSearch.set('');
    } else {
      this.portabilityResource.reload();
    }
  }

  async loadOperators() {
    try {
      const response = await this.operatorApi.list({ limit: this.listLimit });
      const rawItems = (response?.data?.items ?? []) as VoipDidOperatorItem[];
      const items: VoipDidOperatorItem[] = rawItems.filter((item) => item.VdoStatus === 1);
      const map = new Map<string, VoipDidOperatorItem>();
      items.forEach((item) => {
        map.set(item.VdoUUID, item);
        map.set(item.VdoUUID.toLowerCase(), item);
      });
      this.operatorMap.set(map);
      this.operators.set(items.map((item) => ({ value: item.VdoUUID, label: item.VdoName })));
    } catch (err) {
      console.error('Failed to load operators.', err);
    }
  }

  async loadCustomers() {
    try {
      const response = await this.customerApi.get<any>('erp/customers');
      const items: CustomerItem[] = response?.data?.items ?? [];
      const map = new Map<string, CustomerItem>();
      items.forEach((item) => {
        map.set(item.CustomerUUID, item);
        map.set(item.CustomerUUID.toLowerCase(), item);
      });
      this.customerMap.set(map);
      this.customers.set(items.map((item) => ({ value: item.CustomerUUID, label: item.Name })));
    } catch (err) {
      console.error('Failed to load customers.', err);
    }
  }

  private async fetchPortability(filters: PortabilityFilters): Promise<VoipPortabilityItem[]> {
    this.error.set(null);
    const response = await this.api.list({
      search: filters.search || undefined,
      limit: this.listLimit,
    });
    return response?.data?.items ?? [];
  }

  async refreshList() {
    await this.loadOperators();
    await this.loadCustomers();
    this.portabilityResource.reload();
  }

  refresh() {
    return this.refreshList();
  }

  startCreate() {
    this.resetForm();
    this.openPortabilityDialog();
  }

  editPortability(item: VoipPortabilityItem) {
    this.editing.set(item);
    this.formModel.set({
      customerUUID: item.CustomerCusUUID,
      number: item.Number,
      direction: item.Direction,
      donorOperatorUUID: item.DonorVoipDidOperatorVdoUUID,
      recipientOperatorUUID: item.RecipientVoipDidOperatorVdoUUID,
      status: item.Status,
      requestedAt: this.parseDateInput(item.RequestedAt),
      scheduledAt: this.parseDateInput(item.ScheduledAt),
      confirmedAt: this.parseDateInput(item.ConfirmedAt),
      completedAt: this.parseDateInput(item.CompletedAt),
      reason: item.Reason ?? '',
      notes: item.Notes ?? '',
    });
    this.openPortabilityDialog();
  }

  cancelEdit() {
    this.resetForm();
    this.closePortabilityDialog();
  }

  async submit(saveAndNew = false) {
    if (!this.form().valid()) return;
    if (this.hasSameOperator()) {
      this.snack.warning('Donor and recipient operators must be different.');
      return;
    }

    const raw = this.formModel();
    const payload = {
      customerUUID: raw.customerUUID,
      number: raw.number,
      direction: raw.direction,
      donorOperatorUUID: raw.donorOperatorUUID,
      recipientOperatorUUID: raw.recipientOperatorUUID,
      status: raw.status || null,
      requestedAt: this.formatDateInput(raw.requestedAt),
      scheduledAt: this.formatDateInput(raw.scheduledAt),
      confirmedAt: this.formatDateInput(raw.confirmedAt),
      completedAt: this.formatDateInput(raw.completedAt),
      reason: raw.reason?.trim() || null,
      notes: raw.notes?.trim() || null,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      if (this.editing()) {
        await this.api.update(this.editing()!.VoipPortabilityUUID, payload);
      } else {
        await this.api.create(payload);
      }

      this.portabilityResource.reload();
      if (saveAndNew && !this.editing()) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      const message =
        err?.error?.message ||
        err?.error?.error ||
        err?.message ||
        'Failed to save portability record.';
      this.error.set(message);
      this.snack.error(message);
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewPortability() {
    void this.submit(true);
  }

  async removePortability(item: VoipPortabilityItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Portability',
        message: `Are you sure you want to delete "${item.Number}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.remove(item.VoipPortabilityUUID);
      this.dataSource.data = this.dataSource.data.filter(
        (row) => row.VoipPortabilityUUID !== item.VoipPortabilityUUID,
      );
      this.selectedPortabilityUUIDs.delete(item.VoipPortabilityUUID);
    } catch (err: any) {
      const message =
        err?.error?.message ||
        err?.error?.error ||
        err?.message ||
        'Failed to delete portability record.';
      this.error.set(message);
      this.snack.error(message);
    }
  }

  readonly selectedPortabilityUUIDs = new Set<string>();

  get selectedCount() {
    return this.selectedPortabilityUUIDs.size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipPortabilityItem) {
    return this.selectedPortabilityUUIDs.has(item.VoipPortabilityUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  togglePortabilitySelection(item: VoipPortabilityItem, checked: boolean) {
    if (checked) {
      this.selectedPortabilityUUIDs.add(item.VoipPortabilityUUID);
    } else {
      this.selectedPortabilityUUIDs.delete(item.VoipPortabilityUUID);
    }
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.togglePortabilitySelection(row, checked));
  }

  async removeSelectedPortabilities() {
    const ids = Array.from(this.selectedPortabilityUUIDs);
    if (!ids.length) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Selected Portabilities',
        message: `Are you sure you want to delete ${ids.length} selected portability record(s)?`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingSelected.set(true);
    this.error.set(null);
    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.VoipPortabilityUUID),
      );
      this.dataSource.data = this.dataSource.data.filter(
        (row) => !deleted.has(row.VoipPortabilityUUID),
      );
      this.selectedPortabilityUUIDs.clear();
      failed.forEach((uuid) => this.selectedPortabilityUUIDs.add(uuid));
      if (failed.size) {
        this.error.set(`${failed.size} selected portability record(s) could not be deleted.`);
      }
      this.portabilityResource.reload();
    } catch (err: any) {
      const message =
        err?.error?.message ||
        err?.error?.error ||
        err?.message ||
        'Failed to delete selected portability records.';
      this.error.set(message);
      this.snack.error(message);
    } finally {
      this.deletingSelected.set(false);
    }
  }

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closePortabilityDialog();
  
  });

  operatorLabel(uuid: string) {
    if (!uuid) return '';
    return this.operatorMap().get(uuid)?.VdoName ?? '';
  }

  customerLabel(uuid: string) {
    if (!uuid) return '';
    return this.customerMap().get(uuid)?.Name ?? '';
  }

  ticketLabel(item: VoipPortabilityItem) {
    return item.SupportTicketID ?? item.SupportTicketStkUUID ?? '';
  }

  directionLabel(value: string) {
    return this.directionOptions.find((option) => option.value === value)?.label ?? value;
  }

  statusLabel(value: string) {
    return this.statusOptions.find((option) => option.value === value)?.label ?? value;
  }

  private resetForm() {
    this.formModel.set(this.emptyFormModel());
    this.editing.set(null);
  }

  private openPortabilityDialog() {
    const portabilityFormDialog = this.portabilityFormDialog();
    if (!portabilityFormDialog || this.portabilityFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      portabilityFormDialog,
      'voip-portability-form-dialog',
    );
    this.portabilityFormDialogRef = this.dialogBinding.ref;
    this.portabilityFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.portabilityFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') this.cancelEdit();
      });
  }

  private closePortabilityDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.portabilityFormDialogRef?.close();
    this.portabilityFormDialogRef = null;
  }

  get filteredCustomers() {
    const value = this.customerSearch().trim().toLowerCase();
    if (!value) return this.customers();
    return this.customers().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  get filteredOperators() {
    const value = this.donorSearch().trim().toLowerCase();
    if (!value) return this.operators();
    return this.operators().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  get filteredRecipientOperators() {
    const value = this.recipientSearch().trim().toLowerCase();
    if (!value) return this.operators();
    return this.operators().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  onCustomerOpened(opened: boolean) {
    if (!opened) {
      this.customerSearch.set('');
    }
  }

  onDonorOpened(opened: boolean) {
    if (!opened) {
      this.donorSearch.set('');
    }
  }

  onRecipientOpened(opened: boolean) {
    if (!opened) {
      this.recipientSearch.set('');
    }
  }

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => row.VoipPortabilityUUID));
    Array.from(this.selectedPortabilityUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedPortabilityUUIDs.delete(uuid);
    });
  }

  private parseDateInput(value?: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    const [datePart] = trimmed.split('T');
    if (!datePart) return null;
    const [year, month, day] = datePart.split('-').map((part) => Number(part));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  private formatDateInput(value: Date | null) {
    if (!value) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.message || err?.error?.error || err?.message || fallback;
  }

  hasSameOperator() {
    const { donorOperatorUUID: donor, recipientOperatorUUID: recipient } = this.formModel();
    if (donor && recipient && donor === recipient) {
      return true;
    }
    return false;
  }

  private emptyFormModel(): PortabilityFormModel {
    return {
      customerUUID: '',
      number: '',
      direction: 'port_in',
      donorOperatorUUID: '',
      recipientOperatorUUID: '',
      status: 'requested',
      requestedAt: null,
      scheduledAt: null,
      confirmedAt: null,
      completedAt: null,
      reason: '',
      notes: '',
    };
  }
}
