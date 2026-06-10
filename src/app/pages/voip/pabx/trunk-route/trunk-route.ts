import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SnackbarService } from '../../../../services/snackbar.service';
import { VoipPabxAccount, VoipPabxService } from '../voip-pabx.service';
import { VoipPabxTrunkRouteUiService } from './trunk-route.service';
import { TranslocoPipe } from '@jsverse/transloco';

type ResourceKind = 'trunks' | 'inbound-routes';
type ResourceRow = {
  uuid: string;
  id: string;
  name: string;
  enabled: string | number;
  pabxUUID: string;
  pabxName?: string | null;
  [key: string]: unknown;
};
type TargetRow = ResourceRow & {
  number?: string | null;
  username?: string | null;
};
type AvailableDid = {
  VddUUID: string;
  VddNumber: string;
  SuggestedPattern?: string | null;
  CustomerName?: string | null;
  OperatorName?: string | null;
};
type ResourceMeta = {
  title: string;
  subtitle: string;
  primary: string;
  primaryKey: string;
  secondary: string;
  secondaryKey: string;
  defaults: Record<string, unknown>;
  trunkMode?: 'optional' | 'required';
};

type TrunkRouteFilters = {
  resource: ResourceKind;
  search: string;
};

const RESOURCE_META: Record<ResourceKind, ResourceMeta> = {
  trunks: {
    title: 'PABX Trunks',
    subtitle: 'Register SIP trunks for the engine configured on the selected PABX server.',
    primary: 'Host',
    primaryKey: 'host',
    secondary: 'Direction',
    secondaryKey: 'direction',
    defaults: {
      direction: 'both',
      authMode: 'ip_acl',
      transport: 'udp',
      port: 5060,
      registerEnabled: false,
      enabled: true,
    },
  },
  'inbound-routes': {
    title: 'PABX Inbound Routes',
    subtitle: 'Route carrier DID traffic to extensions, groups, queues, IVRs or external targets.',
    primary: 'Pattern',
    primaryKey: 'pattern',
    secondary: 'Target type',
    secondaryKey: 'routeType',
    defaults: {
      routeType: 'extension',
      priority: 100,
      context: 'default',
      enabled: true,
    },
    trunkMode: 'optional',
  },
};

@Component({
  selector: 'app-voip-pabx-trunk-route',
  standalone: true,
  imports: [
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
    MatSlideToggleModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    MatCheckboxModule,
    MatMenuModule,
  ],
  templateUrl: './trunk-route.html',
  styleUrls: ['./trunk-route.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class VoipPabxTrunkRoutePage implements AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(VoipPabxTrunkRouteUiService);
  private readonly accountApi = inject(VoipPabxService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  readonly resource = signal<ResourceKind>(
    (this.route.snapshot.data?.['resource'] ?? 'trunks') as ResourceKind,
  );
  readonly meta = computed(() => RESOURCE_META[this.resource()]);
  private readonly mutating = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<ResourceRow | null>(null);
  readonly accountOptions = signal<VoipPabxAccount[]>([]);
  readonly trunkOptions = signal<ResourceRow[]>([]);
  readonly didOptions = signal<AvailableDid[]>([]);
  readonly targetOptions = signal<TargetRow[]>([]);
  readonly selectedIds = new Set<string>();
  readonly displayedColumns = [
    'select',
    'name',
    'account',
    'primary',
    'secondary',
    'status',
    'actions',
  ];
  readonly dataSource = new MatTableDataSource<ResourceRow>([]);
  private readonly appliedFilters = signal<TrunkRouteFilters>({
    resource: this.resource(),
    search: '',
  });
  private readonly itemsResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as ResourceRow[],
    loader: ({ params }) => this.fetchItems(params),
  });
  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());
  readonly audioCodecOptions = ['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'];
  readonly videoCodecOptions = ['H264'];
  readonly directionOptions = ['inbound', 'outbound', 'both'];
  readonly authModeOptions = ['ip_acl', 'digest', 'register', 'none'];
  readonly transportOptions = ['udp', 'tcp', 'tls'];
  search = '';
  searchInput = '';
  accountSearch = '';
  trunkSearch = '';
  didSearch = '';
  targetSearch = '';
  audioCodecSearch = '';
  videoCodecSearch = '';
  passwordVisible = false;
  readonly form = this.fb.nonNullable.group({
    pabxUUID: ['', [Validators.required]],
    trunkUUID: [''],
    didUUID: [''],
    routeTargetUUID: [''],
    name: ['', [Validators.required]],
    primary: ['', [Validators.required]],
    secondary: [''],
    authMode: ['ip_acl'],
    transport: ['udp'],
    port: [5060, [Validators.min(1), Validators.max(65535)]],
    username: [''],
    password: [''],
    realm: [''],
    fromDomain: [''],
    fromUser: [''],
    registerEnabled: [false],
    allowedCidrs: [''],
    priority: [100, [Validators.min(1)]],
    stripDigits: [0, [Validators.min(0)]],
    audioCodecs: [[] as string[]],
    videoCodecs: [[] as string[]],
    status: [true],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly resourceFormDialog = viewChild<TemplateRef<unknown>>('resourceFormDialog');
  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly itemsEffect = effect(() => {
    this.dataSource.data = this.itemsResource.value();
    this.reconcileSelection();
    this.dataSource.paginator?.firstPage();
  });
  private readonly itemsErrorEffect = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.snack.error(this.messageFromError(error));
    this.dataSource.data = [];
    this.reconcileSelection();
  });

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, column) => {
      if (column === 'primary') return this.primaryValue(data);
      if (column === 'secondary') return this.secondaryValue(data);
      if (column === 'account') return data.pabxName ?? '';
      if (column === 'status') return this.statusLabel(data);
      return String((data as Record<string, unknown>)[column] ?? '');
    };
    void this.bootstrap();
  }

  ngOnDestroy() {
    this.closeDialog();
  }
  onSearchChange(value: string) {
    this.searchInput = value;
  }
  applySearchFilters() {
    const nextFilters = this.currentTrunkRouteFilters();
    this.search = nextFilters.search;
    if (this.sameTrunkRouteFilters(nextFilters, this.appliedFilters())) {
      this.itemsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }
  clearSearchFilters() {
    this.search = '';
    this.searchInput = '';
    const nextFilters = { resource: this.resource(), search: '' };
    if (this.sameTrunkRouteFilters(nextFilters, this.appliedFilters())) {
      this.itemsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }
  refreshList() {
    return this.bootstrap();
  }

  startCreate() {
    this.resetForm();
    void this.refreshInboundLookupsForSelectedPabx();
    this.openDialog();
  }
  editItem(item: ResourceRow) {
    this.editing.set(item);
    this.passwordVisible = false;
    this.form.patchValue({
      pabxUUID: item.pabxUUID,
      trunkUUID: String(item['trunkUUID'] ?? ''),
      name: String(item.name ?? ''),
      primary: String(this.primaryValue(item) ?? ''),
      secondary: String(this.secondaryValue(item) ?? ''),
      authMode: String(item['authMode'] ?? 'ip_acl'),
      transport: String(item['transport'] ?? 'udp'),
      port: Number(item['port'] ?? 5060),
      username: this.optionalText(item['username']),
      password: this.optionalText(item['password']),
      realm: this.optionalText(item['realm']),
      fromDomain: this.optionalText(item['fromDomain']),
      fromUser: this.optionalText(item['fromUser']),
      registerEnabled: Number(item['registerEnabled'] ?? 0) === 1,
      allowedCidrs: this.optionalText(item['allowedCidrs']),
      priority: Number(item['priority'] ?? 100),
      stripDigits: Number(item['stripDigits'] ?? 0),
      audioCodecs: this.parseAudioCodecs(String(item['codecs'] ?? '')),
      videoCodecs: this.parseVideoCodecs(String(item['codecs'] ?? '')),
      status: Number(item.enabled ?? 0) === 1,
    });
    if (this.isInboundRouteResource()) {
      this.form.patchValue({
        didUUID: String(item['didUUID'] ?? ''),
        routeTargetUUID: String(item['routeTargetUUID'] ?? ''),
      });
      void this.loadAvailableDids(String(item['didUUID'] ?? ''));
      void this.loadRouteTargets();
    }
    this.openDialog();
  }
  async submit(saveAndNew = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.meta().trunkMode === 'required' && !this.form.controls.trunkUUID.value) {
      this.snack.warning('Select a trunk before saving this route.');
      return;
    }
    if (
      this.isInboundRouteResource() &&
      (!this.form.controls.didUUID.value || !this.form.controls.routeTargetUUID.value)
    ) {
      this.snack.warning('Select a DID and destination before saving this inbound route.');
      return;
    }
    const payload = this.payloadFromForm();
    this.saving.set(true);
    try {
      if (this.editing()) await this.api.update(this.resource(), this.editing()!.uuid, payload);
      else await this.api.create(this.resource(), payload);
      this.itemsResource.reload();
      if (saveAndNew && !this.editing()) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      this.snack.error(err?.error?.error || err?.message || 'Failed to save PABX resource.');
    } finally {
      this.saving.set(false);
    }
  }
  saveAndNew() {
    void this.submit(true);
  }
  cancelEdit() {
    this.resetForm();
    this.closeDialog();
  }
  async removeItem(item: ResourceRow) {
    if (
      !(await this.confirmDelete(`Delete ${this.meta().title}`, `Delete "${item.name}"?`, 'Delete'))
    )
      return;
    try {
      this.mutating.set(true);
      await this.api.remove(this.resource(), item.uuid);
      this.itemsResource.reload();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err));
    } finally {
      this.mutating.set(false);
    }
  }
  get selectedCount() {
    return this.selectedIds.size;
  }
  visibleRows() {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    const p = this.dataSource.paginator;
    return p ? rows.slice(p.pageIndex * p.pageSize, p.pageIndex * p.pageSize + p.pageSize) : rows;
  }
  isSelected(item: ResourceRow) {
    return this.selectedIds.has(item.uuid);
  }
  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }
  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }
  toggleSelection(item: ResourceRow, checked: boolean) {
    if (checked) this.selectedIds.add(item.uuid);
    else this.selectedIds.delete(item.uuid);
  }
  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleSelection(row, checked));
  }
  async removeSelected() {
    const ids = Array.from(this.selectedIds);
    if (
      !ids.length ||
      !(await this.confirmDelete(
        `Delete Selected ${this.meta().title}`,
        `Delete ${ids.length} selected record(s)?`,
        'Delete selected',
      ))
    )
      return;
    this.deletingSelected.set(true);
    try {
      const response = await this.api.removeMany(this.resource(), ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map(
          (item: any) => item.uuid ?? item.VptUUID ?? item.VriUUID,
        ),
      );
      this.selectedIds.clear();
      failed.forEach((uuid) => this.selectedIds.add(uuid));
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.uuid));
    } finally {
      this.deletingSelected.set(false);
    }
  }
  filteredAccounts() {
    const value = this.accountSearch.trim().toLowerCase();
    if (!value) return this.accountOptions();
    return this.accountOptions().filter((item) =>
      [item.VpaName, item.CustomerName, item.DomainName].some((field) =>
        String(field ?? '')
          .toLowerCase()
          .includes(value),
      ),
    );
  }
  filteredTrunks() {
    const value = this.trunkSearch.trim().toLowerCase();
    const selectedPabxUUID = this.form.controls.pabxUUID.value;
    const rows = this.trunkOptions().filter((item) => {
      const direction = String(item['direction'] ?? '').toLowerCase();
      const belongsToSelectedPabx = !selectedPabxUUID || item.pabxUUID === selectedPabxUUID;
      return item.enabled === 1 && belongsToSelectedPabx;
    });
    if (!value) return rows;
    return rows.filter((item) =>
      [item.name, item['host'], item['direction']].some((field) =>
        String(field ?? '')
          .toLowerCase()
          .includes(value),
      ),
    );
  }
  filteredDids() {
    const value = this.didSearch.trim().toLowerCase();
    if (!value) return this.didOptions();
    return this.didOptions().filter((item) =>
      [item.VddNumber, item.CustomerName, item.OperatorName].some((field) =>
        String(field ?? '')
          .toLowerCase()
          .includes(value),
      ),
    );
  }
  filteredTargets() {
    const value = this.targetSearch.trim().toLowerCase();
    if (!value) return this.targetOptions();
    return this.targetOptions().filter((item) =>
      [item.name, item['number'], item['username']].some((field) =>
        String(field ?? '')
          .toLowerCase()
          .includes(value),
      ),
    );
  }
  setAccountSearch(value: string) {
    this.accountSearch = value;
  }
  clearAccountSearch(opened: boolean) {
    if (!opened) this.accountSearch = '';
  }
  setTrunkSearch(value: string) {
    this.trunkSearch = value;
  }
  clearTrunkSearch(opened: boolean) {
    if (!opened) this.trunkSearch = '';
  }
  setDidSearch(value: string) {
    this.didSearch = value;
  }
  clearDidSearch(opened: boolean) {
    if (!opened) this.didSearch = '';
  }
  setTargetSearch(value: string) {
    this.targetSearch = value;
  }
  clearTargetSearch(opened: boolean) {
    if (!opened) this.targetSearch = '';
  }
  setAudioCodecSearch(value: string) {
    this.audioCodecSearch = value;
  }
  setVideoCodecSearch(value: string) {
    this.videoCodecSearch = value;
  }
  clearCodecSearch(opened: boolean) {
    if (!opened) {
      this.audioCodecSearch = '';
      this.videoCodecSearch = '';
    }
  }
  filteredAudioCodecs() {
    const value = this.audioCodecSearch.trim().toLowerCase();
    if (!value) return this.audioCodecOptions;
    return this.audioCodecOptions.filter((codec) => codec.toLowerCase().includes(value));
  }
  filteredVideoCodecs() {
    const value = this.videoCodecSearch.trim().toLowerCase();
    if (!value) return this.videoCodecOptions;
    return this.videoCodecOptions.filter((codec) => codec.toLowerCase().includes(value));
  }
  usesTrunk() {
    return false;
  }
  isTrunkResource() {
    return this.resource() === 'trunks';
  }
  isInboundRouteResource() {
    return this.resource() === 'inbound-routes';
  }
  primaryValue(row: ResourceRow) {
    return String(row[this.meta().primaryKey] ?? row.name ?? '');
  }
  secondaryValue(row: ResourceRow) {
    return String(row[this.meta().secondaryKey] ?? '');
  }
  statusLabel(row: ResourceRow) {
    return Number(row.enabled ?? 0) === 1 ? 'Active' : 'Inactive';
  }
  isActive(row: ResourceRow) {
    return Number(row.enabled ?? 0) === 1;
  }
  onPabxChange() {
    if (!this.isInboundRouteResource()) return;
    this.form.patchValue({ didUUID: '', routeTargetUUID: '' });
    this.didOptions.set([]);
    this.targetOptions.set([]);
    void this.loadAvailableDids();
    void this.loadRouteTargets();
  }
  onDidChange(didUUID: string) {
    const did = this.didOptions().find((item) => item.VddUUID === didUUID);
    if (!did) return;
    const currentName = this.form.controls.name.value.trim();
    this.form.patchValue({
      name: currentName || `DID ${did.VddNumber}`,
      primary: did.SuggestedPattern || `^${did.VddNumber}$`,
    });
  }
  onRouteTypeChange() {
    if (!this.isInboundRouteResource()) return;
    this.form.patchValue({ routeTargetUUID: '' });
    void this.loadRouteTargets();
  }

  private payloadFromForm() {
    const value = this.form.getRawValue();
    const meta = this.meta();
    const payload: Record<string, unknown> = {
      ...meta.defaults,
      pabxUUID: value.pabxUUID,
      name: value.name,
      enabled: value.status,
    };
    if (this.usesTrunk()) payload['trunkUUID'] = value.trunkUUID || null;
    if (this.isInboundRouteResource()) {
      payload['trunkUUID'] = null;
      payload['didUUID'] = value.didUUID;
      payload['routeType'] = value.secondary;
      payload['routeTargetUUID'] = value.routeTargetUUID;
    }
    payload[meta.primaryKey] = value.primary;
    payload[meta.secondaryKey] = value.secondary;
    if (this.isTrunkResource()) {
      payload['direction'] = value.secondary;
      payload['authMode'] = value.authMode;
      payload['transport'] = value.transport;
      payload['port'] = value.port;
      payload['username'] = this.payloadText(value.username);
      payload['password'] = this.payloadText(value.password);
      payload['realm'] = this.payloadText(value.realm);
      payload['fromDomain'] = this.payloadText(value.fromDomain);
      payload['fromUser'] = this.payloadText(value.fromUser);
      payload['registerEnabled'] = value.registerEnabled;
      payload['allowedCidrs'] = this.payloadText(value.allowedCidrs);
      payload['priority'] = value.priority;
      payload['codecs'] = this.formatCodecs([...value.audioCodecs, ...value.videoCodecs]);
    }
    return payload;
  }
  private optionalText(value: unknown): string {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    return text && !['null', 'undefined'].includes(text.toLowerCase()) ? text : '';
  }
  private payloadText(value: unknown): string | null {
    return this.optionalText(value) || null;
  }
  private resetForm() {
    const meta = this.meta();
    this.passwordVisible = false;
    this.form.reset({
      pabxUUID: this.accountOptions()[0]?.VpaUUID ?? '',
      trunkUUID: '',
      didUUID: '',
      routeTargetUUID: '',
      name: '',
      primary: '',
      secondary: String(meta.defaults[meta.secondaryKey] ?? ''),
      authMode: String(meta.defaults['authMode'] ?? 'ip_acl'),
      transport: String(meta.defaults['transport'] ?? 'udp'),
      port: Number(meta.defaults['port'] ?? 5060),
      username: '',
      password: '',
      realm: '',
      fromDomain: '',
      fromUser: '',
      registerEnabled: Boolean(meta.defaults['registerEnabled'] ?? false),
      allowedCidrs: '',
      priority: Number(meta.defaults['priority'] ?? 100),
      stripDigits: Number(meta.defaults['stripDigits'] ?? 0),
      audioCodecs: [],
      videoCodecs: [],
      status: true,
    });
    this.didOptions.set([]);
    this.targetOptions.set([]);
    this.editing.set(null);
  }
  private openDialog() {
    const resourceFormDialog = this.resourceFormDialog();
    if (!resourceFormDialog || this.dialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      resourceFormDialog,
      'voip-pabx-trunk-route-form-dialog',
      { onEscape: () => this.cancelEdit() },
    );
    this.dialogRef = this.dialogBinding.ref;
    this.dialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelEdit();
    });
  }
  private closeDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.dialogRef?.close();
    this.dialogRef = null;
  }
  private async loadLookups() {
    const [accounts, trunks] = await Promise.all([
      this.accountApi.list({ limit: this.listLimit }),
      this.api.list('trunks', { limit: this.listLimit }),
    ]);
    this.accountOptions.set(accounts?.data?.items ?? []);
    this.trunkOptions.set(trunks?.data?.items ?? []);
    if (this.isInboundRouteResource()) {
      if (!this.form.controls.pabxUUID.value && this.accountOptions()[0]?.VpaUUID) {
        this.form.controls.pabxUUID.setValue(this.accountOptions()[0].VpaUUID);
      }
      await this.refreshInboundLookupsForSelectedPabx();
    }
  }
  private async bootstrap() {
    await this.loadLookups();
    this.itemsResource.reload();
  }
  private async fetchItems(filters: TrunkRouteFilters): Promise<ResourceRow[]> {
    const res = await this.api.list(filters.resource, {
      search: filters.search,
      limit: this.listLimit,
    });
    return res?.data?.items ?? [];
  }
  private currentTrunkRouteFilters(): TrunkRouteFilters {
    return {
      resource: this.resource(),
      search: this.searchInput.trim(),
    };
  }
  private sameTrunkRouteFilters(left: TrunkRouteFilters, right: TrunkRouteFilters) {
    return left.resource === right.resource && left.search === right.search;
  }
  private async refreshInboundLookupsForSelectedPabx(includeDidUUID = '') {
    if (!this.isInboundRouteResource() || !this.form.controls.pabxUUID.value) {
      this.didOptions.set([]);
      this.targetOptions.set([]);
      return;
    }
    await Promise.all([this.loadAvailableDids(includeDidUUID), this.loadRouteTargets()]);
  }
  private async loadAvailableDids(includeDidUUID = '') {
    const pabxUUID = this.form.controls.pabxUUID.value;
    if (!pabxUUID || !this.isInboundRouteResource()) {
      this.didOptions.set([]);
      return;
    }
    const response = await this.api.listAvailableInboundDids({
      pabxUUID,
      includeDidUUID,
      limit: this.listLimit,
    });
    this.didOptions.set(response?.data?.items ?? []);
  }
  private targetResource() {
    const routeType = this.form.controls.secondary.value;
    if (routeType === 'extension') return 'extensions';
    if (routeType === 'external') return 'externals';
    if (routeType === 'group') return 'groups';
    if (routeType === 'queue') return 'queues';
    if (routeType === 'ivr') return 'ivrs';
    return '';
  }
  private async loadRouteTargets() {
    const pabxUUID = this.form.controls.pabxUUID.value;
    const resource = this.targetResource();
    if (!pabxUUID || !resource || !this.isInboundRouteResource()) {
      this.targetOptions.set([]);
      return;
    }
    try {
      const response = await this.api.list(resource, { limit: this.listLimit, pabxUUID });
      this.targetOptions.set(
        (response?.data?.items ?? []).map((item: any) => this.targetRow(item)),
      );
    } catch (err: any) {
      this.targetOptions.set([]);
      this.snack.error(err?.error?.error || err?.message || 'Failed to load route destinations.');
    }
  }

  private targetRow(item: any): TargetRow {
    const uuid = String(
      item.uuid ??
        item.VpeUUID ??
        item.VpxUUID ??
        item.VpgUUID ??
        item.VpqUUID ??
        item.VpiUUID ??
        '',
    );
    const name = String(
      item.name ??
        item.VpeUsername ??
        item.VpxName ??
        item.VpgName ??
        item.VpqName ??
        item.VpiName ??
        uuid,
    );
    return {
      ...item,
      uuid,
      id: String(
        item.id ?? item.VpeID ?? item.VpxID ?? item.VpgID ?? item.VpqID ?? item.VpiID ?? '',
      ),
      name,
      enabled:
        item.enabled ??
        item.VpeEnabled ??
        item.VpxEnabled ??
        item.VpgEnabled ??
        item.VpqEnabled ??
        item.VpiEnabled ??
        1,
      pabxUUID: String(item.pabxUUID ?? item.VoipPabxAccountVpaUUID ?? ''),
      pabxName: item.pabxName ?? item.PabxName ?? null,
      number: item.number ?? item.VpxNumber ?? item.VpeUsername ?? null,
      username: item.username ?? item.VpeUsername ?? null,
    };
  }
  private reconcileSelection() {
    const valid = new Set(this.dataSource.data.map((row) => row.uuid));
    Array.from(this.selectedIds).forEach((uuid) => {
      if (!valid.has(uuid)) this.selectedIds.delete(uuid);
    });
  }
  private async confirmDelete(title: string, message: string, confirmLabel: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title, message, confirmLabel },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  private messageFromError(err: any) {
    return err?.error?.error || err?.error?.message || err?.message || 'Operation failed.';
  }

  private parseCodecs(codecs: string) {
    return codecs
      .split(',')
      .map((codec) => codec.trim().toUpperCase())
      .filter(Boolean);
  }

  private parseAudioCodecs(codecs: string) {
    return this.parseCodecs(codecs).filter((codec) => !this.videoCodecOptions.includes(codec));
  }

  private parseVideoCodecs(codecs: string) {
    return this.parseCodecs(codecs).filter((codec) => this.videoCodecOptions.includes(codec));
  }

  private formatCodecs(codecs: string[]) {
    const unique = new Set<string>();
    codecs.forEach((codec) => {
      const normalized = codec.trim().toUpperCase();
      if (normalized) unique.add(normalized);
    });
    return Array.from(unique).join(',');
  }
}
