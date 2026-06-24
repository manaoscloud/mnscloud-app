import {
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
  TemplateRef,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { createSignalCrudTable } from '../../../shared/crud/signal-crud-table';

import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';

import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom, takeUntil } from 'rxjs';

import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { VoipPabxAccount, VoipPabxService } from './voip-pabx.service';
import { VoipPabxServerItem, VoipPabxServerService } from './server/server.service';
import { VoipDomainItem, VoipDomainService } from '../domain/domain.service';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { bindDialogEscape } from '../../../shared/dialog/dialog-events.util';
import {
  MnsSearchSelectFieldComponent,
  MnsSearchSelectFieldOption,
} from '../../../shared/forms/mns-search-select-field/mns-search-select-field';

type ServerOption = {
  value: string;
  label: string;
};
type DomainOption = {
  value: string;
  label: string;
};
type CustomerOption = {
  value: string;
  label: string;
};
type CustomerItem = {
  CustomerUUID: string;
  Name: string;
};
type BlacklistItem = {
  VbkUUID: string;
  VbkName: string;
};
type BlacklistOption = {
  value: string;
  label: string;
};
type DialPlanItem = {
  uuid: string;
  name: string;
  code?: string | null;
  isDefault?: number | null;
  enabled?: number | null;
};
type DialPlanOption = {
  value: string;
  label: string;
};
type StorageAccountItem = {
  HsaUUID: string;
  HsaName: string;
  HsaConfig?: string | Record<string, unknown> | null;
  HsaIsActive?: number | null;
  HsaIsDefault?: number | null;
  HspName?: string | null;
  HspProvider?: string | null;
};
type StorageAccountOption = {
  value: string;
  label: string;
};

type PabxAccountFilters = {
  search: string;
  status: '' | 0 | 1;
};

type PabxAccountFormModel = {
  name: string;
  defaultAudioCodecs: string[];
  defaultVideoCodecs: string[];
  serverUUID: string;
  domainUUID: string;
  customerUUID: string;
  dialPlanUUID: string;
  blacklistUUID: string;
  recordingStorageMode: 'default' | 'filesystem' | 'storage';
  storageAccountUUID: string;
  mediaStorageMode: 'default' | 'filesystem' | 'storage';
  mediaStorageAccountUUID: string;
  mediaDeliveryMode: 'default' | 'online' | 'offline';
  timezone: string;
  isActive: number;
  isDefault: number;
};

const emptyPabxAccountFilters = (): PabxAccountFilters => ({
  search: '',
  status: '',
});

@Component({
  selector: 'app-voip-pabx',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatCardModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    MatCheckboxModule,
    MatMenuModule,
    MnsSearchSelectFieldComponent,
  ],
  templateUrl: './pabx.html',
  styleUrls: ['./pabx.scss'],
})
export class VoipPabxPage {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipPabxService);
  private readonly serverApi = inject(VoipPabxServerService);
  private readonly domainApi = inject(VoipDomainService);
  private readonly customerApi = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  private readonly mutating = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipPabxAccount | null>(null);
  readonly search = signal('');
  readonly searchInput = signal('');
  readonly statusInput = signal<'' | 0 | 1>('');
  readonly rows = computed(() =>
    this.filterAccounts(this.accountsResource.value(), this.appliedFilters()),
  );
  readonly table = createSignalCrudTable<VoipPabxAccount>(this.rows, (row, column) =>
    this.sortValue(row, column),
  );
  readonly sortActive = this.table.sortActive;
  readonly sortDirection = this.table.sortDirection;
  readonly pageIndex = this.table.pageIndex;
  readonly pageSize = this.table.pageSize;
  readonly sortedRows = this.table.sortedRows;
  readonly visibleRows = this.table.visibleRows;
  private readonly appliedFilters = signal<PabxAccountFilters>(emptyPabxAccountFilters());
  private readonly accountsResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as VoipPabxAccount[],
    loader: ({ params }) => this.fetchAccounts(params),
  });
  readonly loading = computed(() => this.accountsResource.isLoading() || this.mutating());
  readonly displayedColumns = [
    'select',
    'name',
    'customer',
    'audioCodecs',
    'videoCodecs',
    'server',
    'domain',
    'dialPlan',
    'blacklist',
    'status',
    'default',
    'actions',
  ];
  readonly selectedAccountUUIDs = new Set<string>();

  serverOptions: ServerOption[] = [];
  private serverMap = new Map<string, VoipPabxServerItem>();
  domainOptions: DomainOption[] = [];
  private domainMap = new Map<string, VoipDomainItem>();
  customerOptions: CustomerOption[] = [];
  private customerMap = new Map<string, CustomerItem>();
  blacklistOptions: BlacklistOption[] = [];
  private blacklistMap = new Map<string, BlacklistItem>();
  dialPlanOptions: DialPlanOption[] = [];
  private dialPlanMap = new Map<string, DialPlanItem>();
  storageAccountOptions: StorageAccountOption[] = [];
  private storageAccountMap = new Map<string, StorageAccountItem>();
  readonly selectedServerUUID = signal('');
  readonly serverSelectOptions = computed(() => this.toSelectOptions(this.serverOptions));
  readonly domainSelectOptions = computed(() => this.toSelectOptions(this.domainOptions));
  readonly customerSelectOptions = computed(() => this.toSelectOptions(this.customerOptions));
  readonly blacklistSelectOptions = computed<MnsSearchSelectFieldOption[]>(() => [
    { value: '', label: 'None' },
    ...this.toSelectOptions(this.blacklistOptions),
  ]);
  readonly dialPlanSelectOptions = computed(() => this.toSelectOptions(this.dialPlanOptions));
  readonly storageAccountSelectOptions = computed<MnsSearchSelectFieldOption[]>(() => [
    { value: '', label: 'Default storage account' },
    ...this.toSelectOptions(this.storageAccountOptions),
  ]);
  readonly statusOptions = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];
  readonly defaultOptions = [
    { value: 1, label: 'Yes' },
    { value: 0, label: 'No' },
  ];
  readonly recordingStorageModeOptions = [
    { value: 'default', label: 'Default' },
    { value: 'filesystem', label: 'Filesystem' },
    { value: 'storage', label: 'Storage' },
  ];
  readonly mediaDeliveryModeOptions = [
    { value: 'default', label: 'Default' },
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
  ];
  readonly audioCodecOptions = ['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'];
  readonly videoCodecOptions = ['H264'];

  readonly formModel = signal<PabxAccountFormModel>(this.emptyFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.serverUUID);
    required(schema.domainUUID);
    required(schema.customerUUID);
    required(schema.dialPlanUUID);
  });

  readonly recordingStorageMode = signal<'default' | 'filesystem' | 'storage'>('default');
  readonly mediaStorageMode = signal<'default' | 'filesystem' | 'storage'>('default');
  readonly selectedStorageAccountUUID = signal('');
  readonly selectedMediaStorageAccountUUID = signal('');
  readonly recordingPathPreview = computed(() => {
    const value = this.formModel();
    const editing = this.editing();
    const selectedServerUUID = this.selectedServerUUID() || value.serverUUID;
    const engine = (
      selectedServerUUID ? this.serverMap.get(selectedServerUUID)?.VpsEngine : editing?.ServerEngine
    )?.toLowerCase();
    if (this.recordingStorageMode() !== 'storage') {
      return (
        editing?.RecordingStorageEffectivePath ||
        (engine === 'asterisk'
          ? '/var/spool/asterisk/monitor/mnscloud/YYYYMMDD-{uniqueid}.wav'
          : '/var/lib/freeswitch/recordings/YYYY/MM/DD/{call_uuid}.wav')
      );
    }
    const selectedUUID = this.selectedStorageAccountUUID() || value.storageAccountUUID;
    const selected = selectedUUID ? this.storageAccountMap.get(selectedUUID) : null;
    const account =
      selected?.HsaName ?? editing?.RecordingStorageAccountName ?? 'Default storage account';
    const provider = selected?.HspProvider ?? editing?.RecordingStorageProvider ?? 'storage';
    return (
      editing?.RecordingStorageEffectivePath ||
      `${provider}://${account}/pabx/{pabx_uuid}/recordings/YYYY/MM/DD/{call_uuid}.wav`
    );
  });
  readonly pabxFormDialog = viewChild<TemplateRef<unknown>>('pabxFormDialog');
  private pabxFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly accountsEffect = effect(() => {
    this.rows();
    this.reconcileSelection();
    this.applyFilter();
  });
  private readonly accountsErrorEffect = effect(() => {
    const error = this.accountsResource.error();
    if (!error) return;
    this.snack.error(this.messageFromError(error, 'Failed to load accounts.'));
    this.rows();
    this.reconcileSelection();
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closePabxDialog();
  });

  onSearchChange(value: string) {
    this.searchInput.set(value);
  }
  setSort(sort: Sort): void {
    this.table.setSort(sort);
  }

  setPage(page: PageEvent): void {
    this.table.setPage(page);
  }

  applySearchFilters() {
    const nextFilters = this.currentPabxAccountFilters();
    this.search.set(nextFilters.search);
    if (this.samePabxAccountFilters(nextFilters, this.appliedFilters())) {
      this.accountsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.statusInput.set('');
    this.search.set('');
    const nextFilters = emptyPabxAccountFilters();
    if (this.samePabxAccountFilters(nextFilters, this.appliedFilters())) {
      this.accountsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  refreshList() {
    this.accountsResource.reload();
  }

  startCreate() {
    this.resetForm();
    this.openPabxDialog();
  }

  startEdit(item: VoipPabxAccount) {
    this.editing.set(item);
    this.formModel.set({
      name: item.VpaName,
      defaultAudioCodecs: this.parseCodecs(item.VpaDefaultAudioCodecs, this.audioCodecOptions),
      defaultVideoCodecs: this.parseCodecs(item.VpaDefaultVideoCodecs, this.videoCodecOptions),
      serverUUID: item.VoipPabxServerVpsUUID ?? '',
      domainUUID: item.VoipDomainVdmUUID ?? '',
      customerUUID: item.CustomerCusUUID ?? '',
      dialPlanUUID: item.VoipPabxDialPlanVdpUUID ?? '',
      blacklistUUID: item.VoipBlacklistVbkUUID ?? '',
      recordingStorageMode: item.VpaRecordingStorageMode ?? 'default',
      storageAccountUUID: item.HostingStorageAccountHsaUUID ?? '',
      mediaStorageMode: item.VpaMediaStorageMode ?? 'default',
      mediaStorageAccountUUID: item.MediaHostingStorageAccountHsaUUID ?? '',
      mediaDeliveryMode: item.VpaMediaDeliveryMode ?? 'default',
      timezone: item.VpaTimezone ?? '',
      isActive: item.VpaIsActive === 1 ? 1 : 0,
      isDefault: item.VpaIsDefault === 1 ? 1 : 0,
    });
    this.selectedServerUUID.set(item.VoipPabxServerVpsUUID ?? '');
    this.recordingStorageMode.set(item.VpaRecordingStorageMode ?? 'default');
    this.mediaStorageMode.set(item.VpaMediaStorageMode ?? 'default');
    this.selectedStorageAccountUUID.set(item.HostingStorageAccountHsaUUID ?? '');
    this.selectedMediaStorageAccountUUID.set(item.MediaHostingStorageAccountHsaUUID ?? '');
    this.openPabxDialog();
  }

  cancelEdit() {
    this.resetForm();
    this.closePabxDialog();
  }

  async saveAccount(createAnother = false) {
    if (!this.form().valid()) return;

    const value = this.formModel();
    const payload = {
      name: value.name,
      defaultAudioCodecs: this.formatCodecs(value.defaultAudioCodecs),
      defaultVideoCodecs: this.formatCodecs(value.defaultVideoCodecs),
      serverUUID: value.serverUUID,
      domainUUID: value.domainUUID,
      customerUUID: value.customerUUID,
      dialPlanUUID: value.dialPlanUUID,
      blacklistUUID: value.blacklistUUID || '',
      recordingStorageMode: value.recordingStorageMode,
      storageAccountUUID:
        value.recordingStorageMode === 'storage' ? value.storageAccountUUID || '' : '',
      mediaStorageMode: value.mediaStorageMode,
      mediaStorageAccountUUID:
        value.mediaStorageMode === 'storage' ? value.mediaStorageAccountUUID || '' : '',
      mediaDeliveryMode: value.mediaDeliveryMode,
      timezone: value.timezone || '',
      isActive: value.isActive === 1,
      isDefault: value.isDefault === 1,
    };

    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VpaUUID, payload);
        this.snack.success('PABX account updated successfully.');
      } else {
        await this.api.create(payload);
        this.snack.success('PABX account created successfully.');
      }
      this.accountsResource.reload();
      if (createAnother && !editing) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to save account.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewAccount() {
    void this.saveAccount(true);
  }

  async removeAccount(item: VoipPabxAccount) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete PABX Account',
        message: `Are you sure you want to delete "${item.VpaName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      this.mutating.set(true);
      await this.api.remove(item.VpaUUID);
      this.snack.success('PABX account deleted successfully.');
      this.selectedAccountUUIDs.delete(item.VpaUUID);
      this.accountsResource.reload();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete account.'));
    } finally {
      this.mutating.set(false);
    }
  }

  get selectedCount() {
    return this.selectedAccountUUIDs.size;
  }

  isSelected(item: VoipPabxAccount) {
    return this.selectedAccountUUIDs.has(item.VpaUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleAccountSelection(item: VoipPabxAccount, checked: boolean) {
    if (checked) {
      this.selectedAccountUUIDs.add(item.VpaUUID);
    } else {
      this.selectedAccountUUIDs.delete(item.VpaUUID);
    }
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleAccountSelection(row, checked));
  }

  async removeSelectedAccounts() {
    const ids = Array.from(this.selectedAccountUUIDs);
    if (!ids.length) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Selected PABX Accounts',
        message: `Are you sure you want to delete ${ids.length} selected PABX account(s)?`,
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
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.VpaUUID),
      );
      this.rows();
      this.selectedAccountUUIDs.clear();
      failed.forEach((uuid) => this.selectedAccountUUIDs.add(uuid));
      if (failed.size) {
        this.snack.warning(`${failed.size} selected PABX account(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size} selected PABX account(s) deleted successfully.`);
      }
      this.applyFilter();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete selected PABX accounts.'));
    } finally {
      this.deletingSelected.set(false);
    }
  }

  domainLabel(domainUUID: string, fallbackName: string | null = null) {
    if (!domainUUID) return '-';
    const found = this.domainMap.get(domainUUID);
    if (found?.VdmName) return found.VdmName;
    if (fallbackName) return fallbackName;
    return domainUUID;
  }

  serverLabel(serverUUID: string, fallbackName: string | null = null) {
    if (!serverUUID) return '-';
    const found = this.serverMap.get(serverUUID);
    if (found?.VpsName) return found.VpsName;
    if (fallbackName) return fallbackName;
    return serverUUID;
  }

  customerLabel(customerUUID: string, fallbackName: string | null = null) {
    if (!customerUUID) return '-';
    const found = this.customerMap.get(customerUUID);
    if (found?.Name) return found.Name;
    if (fallbackName) return fallbackName;
    return customerUUID;
  }

  blacklistLabel(blacklistUUID: string, fallbackName: string | null = null) {
    if (!blacklistUUID) return '-';
    const found = this.blacklistMap.get(blacklistUUID);
    if (found?.VbkName) return found.VbkName;
    if (fallbackName) return fallbackName;
    return blacklistUUID;
  }

  dialPlanLabel(dialPlanUUID: string, fallbackName: string | null = null) {
    if (!dialPlanUUID) return '-';
    const found = this.dialPlanMap.get(dialPlanUUID);
    if (found?.name) return found.name;
    if (fallbackName) return fallbackName;
    return dialPlanUUID;
  }

  onRecordingStorageModeChange(value: 'default' | 'filesystem' | 'storage') {
    this.recordingStorageMode.set(value);
    if (value !== 'storage') {
      this.formModel.update((current) => ({ ...current, storageAccountUUID: '' }));
      this.selectedStorageAccountUUID.set('');
    }
  }

  onMediaStorageModeChange(value: 'default' | 'filesystem' | 'storage') {
    this.mediaStorageMode.set(value);
    if (value !== 'storage') {
      this.formModel.update((current) => ({ ...current, mediaStorageAccountUUID: '' }));
      this.selectedMediaStorageAccountUUID.set('');
    }
  }

  private resetForm() {
    const fallbackServerUUID = this.serverOptions[0]?.value ?? '';
    const fallbackDomainUUID = this.domainOptions[0]?.value ?? '';
    const fallbackCustomerUUID = this.customerOptions[0]?.value ?? '';
    const fallbackDialPlanUUID =
      this.dialPlanOptions.find((option) => this.dialPlanMap.get(option.value)?.isDefault === 1)
        ?.value ??
      this.dialPlanOptions[0]?.value ??
      '';
    this.formModel.set({
      name: '',
      defaultAudioCodecs: ['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'],
      defaultVideoCodecs: ['H264'],
      serverUUID: fallbackServerUUID,
      domainUUID: fallbackDomainUUID,
      customerUUID: fallbackCustomerUUID,
      dialPlanUUID: fallbackDialPlanUUID,
      blacklistUUID: '',
      recordingStorageMode: 'default',
      storageAccountUUID: '',
      mediaStorageMode: 'default',
      mediaStorageAccountUUID: '',
      mediaDeliveryMode: 'default',
      timezone: '',
      isActive: 1,
      isDefault: 0,
    });
    this.recordingStorageMode.set('default');
    this.mediaStorageMode.set('default');
    this.selectedStorageAccountUUID.set('');
    this.selectedMediaStorageAccountUUID.set('');
    this.selectedServerUUID.set(fallbackServerUUID);
    this.editing.set(null);
  }

  private applyFilter() {
    this.table.setPage({
      pageIndex: 0,
      pageSize: this.pageSize(),
      length: this.sortedRows().length,
    });
  }

  private reconcileSelection() {
    const validIds = new Set(this.rows().map((row) => row.VpaUUID));
    Array.from(this.selectedAccountUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedAccountUUIDs.delete(uuid);
    });
  }

  private async fetchDomains() {
    const response = await this.domainApi.list({ limit: this.listLimit });
    const domains = (response?.data?.items ?? []) as VoipDomainItem[];
    this.domainMap = new Map(domains.map((domain) => [domain.VdmUUID, domain]));
    this.domainOptions = domains.map((domain) => ({
      value: domain.VdmUUID,
      label: Number(domain.VdmStatus ?? 0) === 1 ? domain.VdmName : `${domain.VdmName} (inactive)`,
    }));

    const current = this.formModel().domainUUID;
    if (!current || !this.domainMap.has(current)) {
      this.formModel.update((value) => ({
        ...value,
        domainUUID: this.domainOptions[0]?.value ?? '',
      }));
    }
  }

  private async fetchServers() {
    const response = await this.serverApi.list(false, { limit: this.listLimit });
    const servers = (response?.data?.items ?? []) as VoipPabxServerItem[];
    this.serverMap = new Map(servers.map((server) => [server.VpsUUID, server]));
    this.serverOptions = servers.map((server) => ({
      value: server.VpsUUID,
      label: Number(server.VpsStatus ?? 0) === 1 ? server.VpsName : `${server.VpsName} (inactive)`,
    }));
    const current = this.formModel().serverUUID;
    if (!current || !this.serverMap.has(current)) {
      this.formModel.update((value) => ({
        ...value,
        serverUUID: this.serverOptions[0]?.value ?? '',
      }));
      this.selectedServerUUID.set(this.serverOptions[0]?.value ?? '');
    } else {
      this.selectedServerUUID.set(current);
    }
  }

  private async fetchCustomers() {
    const response = await this.customerApi.get<any>('erp/customers');
    const customers = (response?.data?.items ?? []) as CustomerItem[];
    this.customerMap = new Map(customers.map((customer) => [customer.CustomerUUID, customer]));
    this.customerOptions = customers.map((customer) => ({
      value: customer.CustomerUUID,
      label: customer.Name,
    }));

    const current = this.formModel().customerUUID;
    if (!current || !this.customerMap.has(current)) {
      this.formModel.update((value) => ({
        ...value,
        customerUUID: this.customerOptions[0]?.value ?? '',
      }));
    }
  }

  private async fetchBlacklists() {
    const response = await this.customerApi.get<any>(
      `voip/pabx/blacklists?limit=${this.listLimit}`,
    );
    const blacklists = (response?.data?.items ?? []) as BlacklistItem[];
    this.blacklistMap = new Map(blacklists.map((item) => [item.VbkUUID, item]));
    this.blacklistOptions = blacklists.map((item) => ({
      value: item.VbkUUID,
      label: item.VbkName,
    }));

    const current = this.formModel().blacklistUUID;
    if (current && !this.blacklistMap.has(current)) {
      this.formModel.update((value) => ({ ...value, blacklistUUID: '' }));
    }
  }

  private async fetchStorageAccounts() {
    const response = await this.customerApi.get<any>('hosting/storage/accounts');
    const accounts = (Array.isArray(response?.data) ? response.data : []) as StorageAccountItem[];
    this.storageAccountMap = new Map(accounts.map((item) => [item.HsaUUID, item]));
    this.storageAccountOptions = accounts
      .filter((item) => Number(item.HsaIsActive ?? 0) === 1)
      .map((item) => ({
        value: item.HsaUUID,
        label: `${item.HsaName}${item.HsaIsDefault === 1 ? ' (default)' : ''}`,
      }));

    const current = this.formModel().storageAccountUUID;
    if (current && !this.storageAccountMap.has(current)) {
      this.formModel.update((value) => ({ ...value, storageAccountUUID: '' }));
      this.selectedStorageAccountUUID.set('');
    }
  }

  private async fetchDialPlans() {
    const response = await this.customerApi.get<any>(
      `voip/pabx/dial-plans?limit=${this.listLimit}`,
    );
    const dialPlans = (response?.data?.items ?? []) as DialPlanItem[];
    this.dialPlanMap = new Map(dialPlans.map((item) => [item.uuid, item]));
    this.dialPlanOptions = dialPlans.map((item) => ({
      value: item.uuid,
      label: `${item.name}${item.isDefault === 1 ? ' (default)' : ''}`,
    }));

    const current = this.formModel().dialPlanUUID;
    if (!current || !this.dialPlanMap.has(current)) {
      const defaultPlan = dialPlans.find((item) => item.isDefault === 1);
      this.formModel.update((value) => ({
        ...value,
        dialPlanUUID: defaultPlan?.uuid ?? this.dialPlanOptions[0]?.value ?? '',
      }));
    }
  }

  private async fetchAccounts(filters: PabxAccountFilters): Promise<VoipPabxAccount[]> {
    await this.fetchServers();
    await this.fetchDomains();
    await this.fetchCustomers();
    await this.fetchDialPlans();
    await this.fetchBlacklists();
    await this.fetchStorageAccounts();
    const res = await this.api.list({
      search: filters.search,
      limit: this.listLimit,
    });
    return res?.data?.items ?? [];
  }

  private currentPabxAccountFilters(): PabxAccountFilters {
    return {
      search: this.searchInput().trim(),
      status: this.statusInput(),
    };
  }

  private emptyFormModel(): PabxAccountFormModel {
    return {
      name: '',
      defaultAudioCodecs: ['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'],
      defaultVideoCodecs: ['H264'],
      serverUUID: '',
      domainUUID: '',
      customerUUID: '',
      dialPlanUUID: '',
      blacklistUUID: '',
      recordingStorageMode: 'default',
      storageAccountUUID: '',
      mediaStorageMode: 'default',
      mediaStorageAccountUUID: '',
      mediaDeliveryMode: 'default',
      timezone: '',
      isActive: 1,
      isDefault: 0,
    };
  }

  private samePabxAccountFilters(left: PabxAccountFilters, right: PabxAccountFilters) {
    return left.search === right.search && left.status === right.status;
  }

  private filterAccounts(
    rows: readonly VoipPabxAccount[],
    filters: PabxAccountFilters,
  ): VoipPabxAccount[] {
    if (filters.status === '') return [...rows];
    return rows.filter((row) => Number(row.VpaIsActive ?? 0) === filters.status);
  }

  private parseCodecs(value: string | null | undefined, fallback: string[]): string[] {
    const codecs = (value ?? '')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    return codecs.length ? codecs : fallback;
  }

  private formatCodecs(value: string[] | string | null | undefined) {
    const source = Array.isArray(value) ? value : String(value ?? '').split(',');
    return [...new Set(source.map((item) => item.trim().toUpperCase()).filter(Boolean))].join(',');
  }

  private toSelectOptions<T extends { value: string; label: string }>(
    options: T[],
  ): MnsSearchSelectFieldOption[] {
    return options.map((option) => ({
      value: option.value,
      label: option.label,
      searchText: option.value,
    }));
  }

  private sortValue(row: VoipPabxAccount, column: string): string | number {
    switch (column) {
      case 'name':
        return this.normalizeSortText(row.VpaName);
      case 'audioCodecs':
        return this.normalizeSortText(row.VpaDefaultAudioCodecs ?? '');
      case 'videoCodecs':
        return this.normalizeSortText(row.VpaDefaultVideoCodecs ?? '');
      case 'server':
        return this.normalizeSortText(
          this.serverLabel(row.VoipPabxServerVpsUUID ?? '', row.ServerName ?? null),
        );
      case 'domain':
        return this.normalizeSortText(
          this.domainLabel(row.VoipDomainVdmUUID ?? '', row.DomainName ?? null),
        );
      case 'blacklist':
        return this.normalizeSortText(
          this.blacklistLabel(row.VoipBlacklistVbkUUID ?? '', row.BlacklistName ?? null),
        );
      case 'dialPlan':
        return this.normalizeSortText(
          this.dialPlanLabel(row.VoipPabxDialPlanVdpUUID ?? '', row.DialPlanName ?? null),
        );
      case 'customer':
        return this.normalizeSortText(
          this.customerLabel(row.CustomerCusUUID ?? '', row.CustomerName ?? null),
        );
      case 'status':
        return Number(row.VpaIsActive ?? 0);
      case 'default':
        return Number(row.VpaIsDefault ?? 0);
      default:
        return this.normalizeSortText(String((row as Record<string, unknown>)[column] ?? ''));
    }
  }

  private normalizeSortText(value: string) {
    return value.trim().toLowerCase();
  }

  private openPabxDialog() {
    const pabxFormDialog = this.pabxFormDialog();
    if (!pabxFormDialog || this.pabxFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      pabxFormDialog,
      'voip-pabx-form-dialog',
    );
    this.pabxFormDialogRef = this.dialogBinding.ref;
    bindDialogEscape(this.pabxFormDialogRef, () => {
      this.cancelEdit();
    });
  }

  private closePabxDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.pabxFormDialogRef?.close();
    this.pabxFormDialogRef = null;
  }

  private messageFromError(err: any, fallback: string) {
    return err?.error?.message || err?.error?.error || err?.message || fallback;
  }
}
