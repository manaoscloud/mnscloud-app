import {
  AfterViewInit,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  resource,
  signal,
  TemplateRef,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom, takeUntil } from 'rxjs';

import { fadeIn } from '../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { VoipPabxAccount, VoipPabxService } from './voip-pabx.service';
import { VoipPabxServerItem, VoipPabxServerService } from './server/server.service';
import { VoipDomainItem, VoipDomainService } from '../domain/domain.service';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';

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
};

const emptyPabxAccountFilters = (): PabxAccountFilters => ({
  search: '',
});

@Component({
  selector: 'app-voip-pabx',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
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
  ],
  templateUrl: './pabx.html',
  styleUrls: ['./pabx.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class VoipPabxPage implements AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipPabxService);
  private readonly serverApi = inject(VoipPabxServerService);
  private readonly domainApi = inject(VoipDomainService);
  private readonly customerApi = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly pageTitle = computed(() => 'PABX');
  readonly pageSubtitle = computed(() => 'Register tenant PABX accounts and default codecs.');

  private readonly mutating = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipPabxAccount | null>(null);
  search = '';
  searchInput = '';

  readonly dataSource = new MatTableDataSource<VoipPabxAccount>([]);
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
  readonly serverSearch = signal('');
  readonly domainSearch = signal('');
  readonly customerSearch = signal('');
  readonly blacklistSearch = signal('');
  readonly dialPlanSearch = signal('');
  readonly storageAccountSearch = signal('');
  readonly selectedServerUUID = signal('');
  readonly filteredServerOptions = computed(() =>
    this.filterOptions(this.serverOptions, this.serverSearch()),
  );
  readonly filteredDomainOptions = computed(() =>
    this.filterOptions(this.domainOptions, this.domainSearch()),
  );
  readonly filteredCustomerOptions = computed(() =>
    this.filterOptions(this.customerOptions, this.customerSearch()),
  );
  readonly filteredBlacklistOptions = computed(() =>
    this.filterOptions(this.blacklistOptions, this.blacklistSearch()),
  );
  readonly filteredDialPlanOptions = computed(() =>
    this.filterOptions(this.dialPlanOptions, this.dialPlanSearch()),
  );
  readonly filteredStorageAccountOptions = computed(() =>
    this.filterOptions(this.storageAccountOptions, this.storageAccountSearch()),
  );
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

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    defaultAudioCodecs: [['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'] as string[]],
    defaultVideoCodecs: [['H264'] as string[]],
    serverUUID: ['', [Validators.required]],
    domainUUID: ['', [Validators.required]],
    customerUUID: ['', [Validators.required]],
    dialPlanUUID: ['', [Validators.required]],
    blacklistUUID: [''],
    recordingStorageMode: ['default' as 'default' | 'filesystem' | 'storage'],
    storageAccountUUID: [''],
    mediaStorageMode: ['default' as 'default' | 'filesystem' | 'storage'],
    mediaStorageAccountUUID: [''],
    mediaDeliveryMode: ['default' as 'default' | 'online' | 'offline'],
    timezone: [''],
    isActive: [1],
    isDefault: [0],
  });

  readonly recordingStorageMode = signal<'default' | 'filesystem' | 'storage'>('default');
  readonly mediaStorageMode = signal<'default' | 'filesystem' | 'storage'>('default');
  readonly selectedStorageAccountUUID = signal('');
  readonly selectedMediaStorageAccountUUID = signal('');
  readonly recordingPathPreview = computed(() => {
    const value = this.form.getRawValue();
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

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly pabxFormDialog = viewChild<TemplateRef<unknown>>('pabxFormDialog');
  private pabxFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly accountsEffect = effect(() => {
    this.dataSource.data = this.accountsResource.value();
    this.reconcileSelection();
    this.applyFilter();
  });
  private readonly accountsErrorEffect = effect(() => {
    const error = this.accountsResource.error();
    if (!error) return;
    this.snack.error(this.messageFromError(error, 'Failed to load accounts.'));
    this.dataSource.data = [];
    this.reconcileSelection();
  });

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      const serverLabel = this.serverLabel(
        data.VoipPabxServerVpsUUID ?? '',
        data.ServerName ?? null,
      ).toLowerCase();
      const domainLabel = this.domainLabel(
        data.VoipDomainVdmUUID ?? '',
        data.DomainName ?? null,
      ).toLowerCase();
      const customerLabel = this.customerLabel(
        data.CustomerCusUUID ?? '',
        data.CustomerName ?? null,
      ).toLowerCase();
      const dialPlanLabel = this.dialPlanLabel(
        data.VoipPabxDialPlanVdpUUID ?? '',
        data.DialPlanName ?? null,
      ).toLowerCase();
      const statusLabel = data.VpaIsActive === 1 ? 'active' : 'inactive';
      const defaultLabel = data.VpaIsDefault === 1 ? 'default' : 'not default';
      return [
        data.VpaName,
        customerLabel,
        data.VpaDefaultAudioCodecs ?? '',
        data.VpaDefaultVideoCodecs ?? '',
        serverLabel,
        domainLabel,
        data.BlacklistName ?? '',
        dialPlanLabel,
        statusLabel,
        defaultLabel,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    this.accountsResource.reload();
  }

  ngOnDestroy() {
    this.closePabxDialog();
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    const nextFilters = this.currentPabxAccountFilters();
    this.search = nextFilters.search;
    if (this.samePabxAccountFilters(nextFilters, this.appliedFilters())) {
      this.accountsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
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
    this.form.patchValue({
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
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
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

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
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
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VpaUUID));
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

  onCustomerOpened(opened: boolean) {
    if (!opened) {
      this.customerSearch.set('');
    }
  }

  onServerOpened(opened: boolean) {
    if (!opened) {
      this.serverSearch.set('');
    }
  }

  onDomainOpened(opened: boolean) {
    if (!opened) {
      this.domainSearch.set('');
    }
  }

  onBlacklistOpened(opened: boolean) {
    if (!opened) {
      this.blacklistSearch.set('');
    }
  }

  onDialPlanOpened(opened: boolean) {
    if (!opened) {
      this.dialPlanSearch.set('');
    }
  }

  onStorageAccountOpened(opened: boolean) {
    if (!opened) {
      this.storageAccountSearch.set('');
    }
  }

  onRecordingStorageModeChange(value: 'default' | 'filesystem' | 'storage') {
    this.recordingStorageMode.set(value);
    if (value !== 'storage') {
      this.form.patchValue({ storageAccountUUID: '' });
      this.selectedStorageAccountUUID.set('');
    }
  }

  onMediaStorageModeChange(value: 'default' | 'filesystem' | 'storage') {
    this.mediaStorageMode.set(value);
    if (value !== 'storage') {
      this.form.patchValue({ mediaStorageAccountUUID: '' });
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
    this.form.reset({
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
    this.dataSource.filter = this.search.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => row.VpaUUID));
    Array.from(this.selectedAccountUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedAccountUUIDs.delete(uuid);
    });
  }

  private async loadDomains() {
    const response = await this.domainApi.list({ limit: this.listLimit });
    const domains = (response?.data?.items ?? []) as VoipDomainItem[];
    this.domainMap = new Map(domains.map((domain) => [domain.VdmUUID, domain]));
    this.domainOptions = domains.map((domain) => ({
      value: domain.VdmUUID,
      label: Number(domain.VdmStatus ?? 0) === 1 ? domain.VdmName : `${domain.VdmName} (inactive)`,
    }));

    const current = this.form.getRawValue().domainUUID;
    if (!current || !this.domainMap.has(current)) {
      this.form.patchValue({ domainUUID: this.domainOptions[0]?.value ?? '' });
    }
  }

  private async loadServers() {
    const response = await this.serverApi.list(false, { limit: this.listLimit });
    const servers = (response?.data?.items ?? []) as VoipPabxServerItem[];
    this.serverMap = new Map(servers.map((server) => [server.VpsUUID, server]));
    this.serverOptions = servers.map((server) => ({
      value: server.VpsUUID,
      label: Number(server.VpsStatus ?? 0) === 1 ? server.VpsName : `${server.VpsName} (inactive)`,
    }));
    const current = this.form.getRawValue().serverUUID;
    if (!current || !this.serverMap.has(current)) {
      this.form.patchValue({ serverUUID: this.serverOptions[0]?.value ?? '' });
      this.selectedServerUUID.set(this.serverOptions[0]?.value ?? '');
    } else {
      this.selectedServerUUID.set(current);
    }
  }

  private async loadCustomers() {
    const response = await this.customerApi.get<any>('erp/customers');
    const customers = (response?.data?.items ?? []) as CustomerItem[];
    this.customerMap = new Map(customers.map((customer) => [customer.CustomerUUID, customer]));
    this.customerOptions = customers.map((customer) => ({
      value: customer.CustomerUUID,
      label: customer.Name,
    }));

    const current = this.form.getRawValue().customerUUID;
    if (!current || !this.customerMap.has(current)) {
      this.form.patchValue({ customerUUID: this.customerOptions[0]?.value ?? '' });
    }
  }

  private async loadBlacklists() {
    const response = await this.customerApi.get<any>(
      `voip/pabx/blacklists?limit=${this.listLimit}`,
    );
    const blacklists = (response?.data?.items ?? []) as BlacklistItem[];
    this.blacklistMap = new Map(blacklists.map((item) => [item.VbkUUID, item]));
    this.blacklistOptions = blacklists.map((item) => ({
      value: item.VbkUUID,
      label: item.VbkName,
    }));

    const current = this.form.getRawValue().blacklistUUID;
    if (current && !this.blacklistMap.has(current)) {
      this.form.patchValue({ blacklistUUID: '' });
    }
  }

  private async loadStorageAccounts() {
    const response = await this.customerApi.get<any>('hosting/storage/accounts');
    const accounts = (Array.isArray(response?.data) ? response.data : []) as StorageAccountItem[];
    this.storageAccountMap = new Map(accounts.map((item) => [item.HsaUUID, item]));
    this.storageAccountOptions = accounts
      .filter((item) => Number(item.HsaIsActive ?? 0) === 1)
      .map((item) => ({
        value: item.HsaUUID,
        label: `${item.HsaName}${item.HsaIsDefault === 1 ? ' (default)' : ''}`,
      }));

    const current = this.form.getRawValue().storageAccountUUID;
    if (current && !this.storageAccountMap.has(current)) {
      this.form.patchValue({ storageAccountUUID: '' });
      this.selectedStorageAccountUUID.set('');
    }
  }

  private async loadDialPlans() {
    const response = await this.customerApi.get<any>(
      `voip/pabx/dial-plans?limit=${this.listLimit}`,
    );
    const dialPlans = (response?.data?.items ?? []) as DialPlanItem[];
    this.dialPlanMap = new Map(dialPlans.map((item) => [item.uuid, item]));
    this.dialPlanOptions = dialPlans.map((item) => ({
      value: item.uuid,
      label: `${item.name}${item.isDefault === 1 ? ' (default)' : ''}`,
    }));

    const current = this.form.getRawValue().dialPlanUUID;
    if (!current || !this.dialPlanMap.has(current)) {
      const defaultPlan = dialPlans.find((item) => item.isDefault === 1);
      this.form.patchValue({
        dialPlanUUID: defaultPlan?.uuid ?? this.dialPlanOptions[0]?.value ?? '',
      });
    }
  }

  private async fetchAccounts(filters: PabxAccountFilters): Promise<VoipPabxAccount[]> {
    await this.loadServers();
    await this.loadDomains();
    await this.loadCustomers();
    await this.loadDialPlans();
    await this.loadBlacklists();
    await this.loadStorageAccounts();
    const res = await this.api.list({
      search: filters.search,
      limit: this.listLimit,
    });
    return res?.data?.items ?? [];
  }

  private currentPabxAccountFilters(): PabxAccountFilters {
    return {
      search: this.searchInput.trim(),
    };
  }

  private samePabxAccountFilters(left: PabxAccountFilters, right: PabxAccountFilters) {
    return left.search === right.search;
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

  private filterOptions<T extends { label: string }>(options: T[], search: string): T[] {
    const value = search.trim().toLowerCase();
    if (!value) return options;
    return options.filter((option) => option.label.toLowerCase().includes(value));
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
    this.pabxFormDialogRef.keydownEvents().pipe(takeUntil(this.pabxFormDialogRef.afterClosed())).subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelEdit();
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
