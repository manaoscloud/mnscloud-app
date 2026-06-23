import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form as createForm, type Field as SignalField } from '@angular/forms/signals';

import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { bindDialogClosed } from '../../../shared/dialog/dialog-events.util';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SnackbarService } from '../../../services/snackbar.service';
import { RealtimeWebRtcService, WebRtcRecord, WebRtcResource, WebRtcScope } from './webrtc.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { InstallCommandDialogComponent } from '../../../shared/install-command-dialog/install-command-dialog';
import {
  MnsSearchSelectFieldComponent,
  MnsSelectFieldComponent,
  MnsStatusSelectFieldComponent,
  MnsTextFieldComponent,
  MnsTextareaFieldComponent,
  type MnsSearchSelectFieldOption,
  type MnsSelectFieldOption,
} from '../../../shared/forms';

type LookupKey = 'servers' | 'domains' | 'mediaServers';
type LookupOption = MnsSearchSelectFieldOption;
type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'lookup' | 'textarea';
  options?: string[];
  lookup?: LookupKey;
  required?: boolean;
  span?: string;
};
type SignalFormField = SignalField<any, any>;

type Config = {
  resource: WebRtcResource;
  title: string;
  subtitle: string;
  uuid: string;
  name: string;
  status: string;
  columns: string[];
  fields: Field[];
};

const COLUMN_LABELS: Record<string, string> = {
  name: 'Name',
  engine: 'Engine',
  hostname: 'Hostname',
  publicDomain: 'Primary Domain',
  mediaServer: 'Media Server',
  publicIP: 'Public IP',
  domain: 'Realtime Domain',
  certificateProvider: 'Certificate',
  nginxStatus: 'Nginx',
  certificateStatus: 'TLS',
  autoProvision: 'Auto',
  version: 'Version',
  lastSeen: 'Last Seen',
  server: 'Server',
  key: 'Key',
  value: 'Value',
  type: 'Type',
  description: 'Description',
  status: 'Status',
};

const CONFIGS: Record<WebRtcResource, Config> = {
  servers: {
    resource: 'servers',
    title: 'WebRTC Servers',
    subtitle: 'Register Kamailio WebRTC edge nodes authorized by node UUID.',
    uuid: 'RwsUUID',
    name: 'RwsName',
    status: 'RwsStatus',
    columns: ['name', 'engine', 'hostname', 'publicDomain', 'mediaServer', 'publicIP', 'status', 'lastSeen'],
    fields: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: ['active', 'inactive'],
        span: 'span-1',
      },
      {
        key: 'engine',
        label: 'Engine',
        type: 'select',
        options: ['kamailio'],
        span: 'span-1',
      },
      { key: 'name', label: 'Name', required: true, span: 'span-1' },
      {
        key: 'realtimeDomainUUID',
        label: 'Primary Domain',
        type: 'lookup',
        lookup: 'domains',
        span: 'span-1',
      },
      {
        key: 'mediaServerUUID',
        label: 'Media Server',
        type: 'lookup',
        lookup: 'mediaServers',
        span: 'span-1',
      },
      { key: 'nodeUUID', label: 'Node UUID' },
      { key: 'hostname', label: 'Hostname' },
      { key: 'publicIP', label: 'Public IP' },
      { key: 'privateIP', label: 'Private IP' },
      { key: 'baseUrl', label: 'Base URL' },
      { key: 'version', label: 'Version' },
      { key: 'configJson', label: 'Config JSON', type: 'textarea', span: 'span-4' },
      { key: 'notes', label: 'Notes', type: 'textarea', span: 'span-4' },
    ],
  },
  parameters: {
    resource: 'parameters',
    title: 'WebRTC Parameters',
    subtitle: 'Manage tenant and edge-specific WebRTC runtime parameters.',
    uuid: 'RwpUUID',
    name: 'RwpKey',
    status: 'RwpStatus',
    columns: ['key', 'server', 'type', 'value', 'status'],
    fields: [
      { key: 'serverUUID', label: 'Server', type: 'lookup', lookup: 'servers' },
      { key: 'key', label: 'Key', required: true },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: ['string', 'number', 'boolean', 'json'],
      },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
      { key: 'valueJson', label: 'Value', type: 'textarea', span: 'span-4' },
      { key: 'description', label: 'Description', type: 'textarea', span: 'span-4' },
    ],
  },
  domains: {
    resource: 'domains',
    title: 'WebRTC Domains',
    subtitle: 'Publish partner and tenant WSS domains on authorized WebRTC edge nodes.',
    uuid: 'RwdUUID',
    name: 'RtdName',
    status: 'RwdStatus',
    columns: [
      'domain',
      'server',
      'certificateProvider',
      'nginxStatus',
      'certificateStatus',
      'autoProvision',
      'status',
    ],
    fields: [
      { key: 'serverUUID', label: 'Server', type: 'lookup', lookup: 'servers', required: true },
      {
        key: 'realtimeDomainUUID',
        label: 'Realtime Domain',
        type: 'lookup',
        lookup: 'domains',
        required: true,
      },
      {
        key: 'certificateProvider',
        label: 'Certificate Provider',
        type: 'select',
        options: ['letsencrypt', 'manual', 'self_signed'],
      },
      {
        key: 'autoProvision',
        label: 'Auto Provision',
        type: 'select',
        options: ['active', 'inactive'],
      },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
      { key: 'notes', label: 'Notes', type: 'textarea', span: 'span-4' },
    ],
  },
};

@Component({
  selector: 'app-realtime-webrtc',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    MnsSearchSelectFieldComponent,
    MnsSelectFieldComponent,
    MnsStatusSelectFieldComponent,
    MnsTextFieldComponent,
    MnsTextareaFieldComponent,
    InstallCommandDialogComponent,
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
  templateUrl: './webrtc.html',
  styleUrls: ['./webrtc.scss'],
})
export class RealtimeWebRtcPage {
  private readonly api = inject(RealtimeWebRtcService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly routeData = toSignal(this.route.data, { initialValue: {} });
  readonly currentResource = computed<WebRtcResource>(() => {
    const data = this.routeData() as Record<string, unknown>;
    const resource = data['resource'];
    return resource === 'domains' || resource === 'parameters' || resource === 'servers'
      ? resource
      : 'servers';
  });
  readonly scope = computed<WebRtcScope>(() => {
    const data = this.routeData() as Record<string, unknown>;
    return data['scope'] === 'master' ? 'master' : 'tenant';
  });
  readonly config = computed(() => CONFIGS[this.currentResource()]);
  readonly title = computed(() => this.config().title);
  readonly subtitle = computed(() => this.config().subtitle);
  readonly saving = signal(false);
  readonly editing = signal<WebRtcRecord | null>(null);
  readonly selected = signal<Set<string>>(new Set());
  readonly generatedInstall = signal<Record<string, string> | null>(null);
  private readonly appliedSearch = signal('');
  private readonly appliedStatus = signal('');
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly statusInput = signal('');
  readonly sortActive = signal('');
  readonly sortDirection = signal<SortDirection>('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  readonly displayedColumns = computed(() => ['select', ...this.config().columns, 'actions']);
  readonly lookups = signal<Record<LookupKey, LookupOption[]>>({
    servers: [],
    domains: [],
    mediaServers: [],
  });
  readonly formModel = signal<Record<string, any>>({});
  readonly form = createForm(this.formModel);
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  readonly installCommandDialog = viewChild<TemplateRef<unknown>>('installCommandDialog');
  private dialogRef: MatDialogRef<unknown> | null = null;
  private binding: CrudDialogBinding | null = null;
  private installCommandBinding: CrudDialogBinding | null = null;

  private readonly recordsResource = resource({
    params: () => ({
      resource: this.config().resource,
      scope: this.scope(),
      search: this.appliedSearch(),
      status: this.appliedStatus(),
    }),
    defaultValue: [] as WebRtcRecord[],
    loader: async ({ params }) => {
      const res = await this.api.list(
        params.resource,
        {
          limit: 5000,
          search: params.search,
          status: params.status,
        },
        params.scope,
      );
      return res?.data?.items ?? [];
    },
  });
  readonly rows = computed(() => this.recordsResource.value());
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

  readonly loading = this.recordsResource.isLoading;

  private readonly syncTableData = effect(() => {
    this.rows();
    this.reconcile();
  });

  private readonly reportLoadError = effect(() => {
    const error = this.recordsResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load WebRTC records.'));
  });

  private readonly resetPageStateOnRouteChange = effect(() => {
    this.currentResource();
    this.scope();
    untracked(() => {
      this.searchInput.set('');
      this.search.set('');
      this.statusInput.set('');
      this.appliedSearch.set('');
      this.appliedStatus.set('');
      this.pageIndex.set(0);
      this.selected.set(new Set());
    });
  });
  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.binding?.stop();
    this.installCommandBinding?.stop();
  });
  uuid(row: WebRtcRecord) {
    return String(row[this.config().uuid] ?? '');
  }
  name(row: WebRtcRecord) {
    return String(row[this.config().name] ?? '');
  }
  status(row: WebRtcRecord) {
    return Number(row[this.config().status] ?? 0) === 1;
  }
  columnLabel(column: string) {
    return COLUMN_LABELS[column] ?? column;
  }
  cell(row: WebRtcRecord, column: string) {
    const map: Record<string, any> = {
      name: this.name(row),
      engine: row['RwsEngine'],
      hostname: row['RwsHostname'],
      publicDomain: row['RtdName'] ?? row['DomainName'] ?? row['RwsPublicDomain'],
      mediaServer: row['RmsName'] ?? row['MediaServerName'],
      publicIP: row['RwsPublicIP'],
      version: row['RwsVersion'],
      lastSeen: row['RwsLastSeenAt'],
      server: row['RwsName'],
      domain: row['RtdName'] ?? row['DomainName'],
      certificateProvider: row['RwdCertificateProvider'],
      nginxStatus: row['RwdNginxStatus'],
      certificateStatus: row['RwdCertificateStatus'],
      autoProvision: Number(row['RwdAutoProvision'] ?? 0) === 1 ? 'YES' : 'NO',
      key: row['RwpKey'],
      value: this.displayValue(row['RwpValue']),
      type: row['RwpType'],
      description: row['RwpDescription'],
      status: this.status(row) ? 'ACTIVE' : 'INACTIVE',
    };
    return map[column] ?? '';
  }
  publicIpParts(row: WebRtcRecord) {
    const raw = String(this.cell(row, 'publicIP') ?? '').trim();
    if (!raw) return [];
    return raw
      .split(/[,\n]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  displayValue(value: unknown) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
  refreshList() {
    this.recordsResource.reload();
  }
  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    this.search.set(nextSearch);
    this.pageIndex.set(0);
    this.appliedSearch.set(nextSearch);
    this.appliedStatus.set(this.statusInput());
  }
  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.statusInput.set('');
    this.pageIndex.set(0);
    this.appliedSearch.set('');
    this.appliedStatus.set('');
  }

  setSort(sort: Sort) {
    this.sortActive.set(sort.active || '');
    this.sortDirection.set(sort.direction || '');
    this.pageIndex.set(0);
  }

  setPage(page: PageEvent) {
    this.pageIndex.set(page.pageIndex);
    this.pageSize.set(page.pageSize);
  }
  async fetchLookups() {
    const needs = new Set(
      this.config()
        .fields.map((field) => field.lookup)
        .filter(Boolean) as LookupKey[],
    );
    await Promise.all(
      [...needs].map(async (key) => {
        const res =
          key === 'domains'
            ? await this.api.listRealtimeDomains({
                limit: 5000,
                purpose: 'webrtc',
              })
            : key === 'mediaServers'
              ? await this.api.listMediaServerOptions()
              : this.config().resource === 'domains' && key === 'servers' && this.scope() === 'tenant'
                ? await this.api.listServerOptions()
                : await this.api.list(key, { limit: 5000 }, 'master');
        const rows = res?.data?.items ?? [];
        const options = rows
          .map((row: WebRtcRecord) => ({
            value: String(
              key === 'domains'
                ? (row['RtdUUID'] ?? '')
                : key === 'mediaServers'
                  ? (row['value'] ?? row['RmsUUID'] ?? '')
                  : (row['RwsUUID'] ?? ''),
            ),
            label: String(
              key === 'domains'
                ? (row['RtdName'] ?? row['DomainName'] ?? '')
                : key === 'mediaServers'
                  ? (row['label'] ?? row['RmsName'] ?? '')
                : (row['RwsName'] ?? ''),
            ),
            description: String(
              key === 'domains'
                ? (row['RtdUUID'] ?? row['DomainName'] ?? '')
                : key === 'mediaServers'
                  ? (row['hostname'] ?? row['controlIP'] ?? row['value'] ?? row['RmsUUID'] ?? '')
                  : (row['RwsHostname'] ?? row['RwsUUID'] ?? ''),
            ),
            searchText: String(
              key === 'domains'
                ? `${row['RtdName'] ?? ''} ${row['DomainName'] ?? ''} ${row['RtdUUID'] ?? ''}`
                : key === 'mediaServers'
                  ? `${row['label'] ?? ''} ${row['hostname'] ?? ''} ${row['controlIP'] ?? ''} ${row['value'] ?? ''}`
                  : `${row['RwsName'] ?? ''} ${row['RwsHostname'] ?? ''} ${row['RwsUUID'] ?? ''}`,
            ),
          }))
          .filter((option: LookupOption) => option.value);
        this.lookups.update((current) => ({ ...current, [key]: options }));
      }),
    );
  }
  lookupOptions(key: LookupKey): readonly MnsSearchSelectFieldOption[] {
    return this.lookups()[key];
  }
  lookupPlaceholder(key: LookupKey): string {
    if (key === 'domains') return 'Search domains';
    if (key === 'mediaServers') return 'Search media servers';
    return 'Search servers';
  }
  hasTextareaFields() {
    return this.config().fields.some((field) => field.type === 'textarea');
  }
  textareaTabLabel() {
    return this.config().fields.some((field) => field.key.toLowerCase().includes('notes'))
      ? 'Notes'
      : 'Config';
  }
  buildForm(row?: WebRtcRecord | null) {
    const nextValue: Record<string, any> = {};
    for (const field of this.config().fields) {
      nextValue[field.key] = this.valueForField(field.key, row);
    }
    this.formModel.set(nextValue);
  }
  valueForField(key: string, row?: WebRtcRecord | null) {
    if (!row) {
      if (key === 'status') return 'active';
      if (key === 'engine' && this.config().resource === 'servers') return 'kamailio';
      return '';
    }
    const m: Record<string, string> = {
      name: this.config().name,
      engine: 'RwsEngine',
      nodeUUID: 'RwsNodeUUID',
      realtimeDomainUUID: 'RealtimeDomainRtdUUID',
      mediaServerUUID: 'RealtimeMediaServerRmsUUID',
      hostname: 'RwsHostname',
      publicIP: 'RwsPublicIP',
      privateIP: 'RwsPrivateIP',
      baseUrl: 'RwsBaseUrl',
      version: 'RwsVersion',
      serverUUID: 'RealtimeWebRtcServerRwsUUID',
      certificateProvider: 'RwdCertificateProvider',
      autoProvision: 'RwdAutoProvision',
      key: 'RwpKey',
      type: 'RwpType',
      description: 'RwpDescription',
    };
    if (key === 'status') return this.status(row) ? 'active' : 'inactive';
    if (key === 'autoProvision')
      return Number(row['RwdAutoProvision'] ?? 1) === 1 ? 'active' : 'inactive';
    if (key === 'notes') {
      return this.config().resource === 'domains'
        ? (row['RwdNotes'] ?? '')
        : (row['RwsNotes'] ?? '');
    }
    if (key === 'configJson') return JSON.stringify(row['RwsConfig'] ?? {}, null, 2);
    if (key === 'valueJson') return this.displayValue(row['RwpValue']);
    return row[m[key]] ?? '';
  }
  async startCreate() {
    this.editing.set(null);
    await this.fetchLookups();
    this.buildForm(null);
    this.openDialog();
  }
  async startEdit(row: WebRtcRecord) {
    this.editing.set(row);
    await this.fetchLookups();
    this.buildForm(row);
    this.openDialog();
  }
  openDialog() {
    const formDialog = this.formDialog();
    if (!formDialog) return;
    this.binding = openCrudTemplateDialog(this.dialog, formDialog, 'realtime-webrtc-form-dialog', {
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
  closeDialog() {
    this.dialogRef?.close();
    this.dialogRef = null;
    this.binding?.stop();
    this.binding = null;
    this.saving.set(false);
  }
  payload() {
    const raw = this.formModel();
    const p: Record<string, any> = { ...raw, status: raw['status'] === 'inactive' ? 0 : 1 };
    if ('autoProvision' in raw) p['autoProvision'] = raw['autoProvision'] === 'inactive' ? 0 : 1;
    if (this.config().resource === 'servers') {
      p['engine'] = 'kamailio';
    }
    if (raw['configJson']) {
      try {
        p['config'] = JSON.parse(raw['configJson']);
      } catch {
        p['config'] = raw['configJson'];
      }
    }
    delete p['configJson'];
    if (raw['valueJson']) {
      try {
        p['value'] = JSON.parse(raw['valueJson']);
      } catch {
        p['value'] = raw['valueJson'];
      }
    }
    delete p['valueJson'];
    return p;
  }

  async submit(saveAndNew = false) {
    if (!this.isFormValid()) return;
    this.saving.set(true);
    try {
      const row = this.editing();
      const resource = this.config().resource;
      const response = row
        ? await this.api.update(resource, this.uuid(row), this.payload(), this.scope())
        : await this.api.create(resource, this.payload(), this.scope());
      this.snack.success('WebRTC record saved.');
      this.recordsResource.reload();
      if (!row && resource === 'servers' && !saveAndNew) {
        const item = response?.data?.item ?? null;
        const createdUUID = String(item?.[this.config().uuid] ?? '');
        this.closeDialog();
        if (createdUUID) await this.generateInstallCommandForUUID(createdUUID, false);
        else this.snack.error('WebRTC server saved, but install command could not be generated.');
        return;
      }
      if (saveAndNew && !row) {
        this.editing.set(null);
        this.buildForm(null);
      } else this.closeDialog();
    } catch (e: any) {
      this.snack.error(e?.error?.error || e?.message || 'Failed to save WebRTC record.');
    } finally {
      this.saving.set(false);
    }
  }

  formField(key: string): SignalFormField {
    return (this.form as any)[key];
  }

  selectOptions(field: Field): MnsSelectFieldOption[] {
    return (field.options ?? []).map((option) => ({
      value: option,
      label: this.optionLabel(option),
    }));
  }

  optionLabel(option: string): string {
    const labels: Record<string, string> = {
      active: 'Active',
      inactive: 'Inactive',
      kamailio: 'Kamailio',
      string: 'String',
      number: 'Number',
      boolean: 'Boolean',
      json: 'JSON',
      letsencrypt: 'Let’s Encrypt',
      manual: 'Manual',
      self_signed: 'Self-signed',
    };
    return labels[option] ?? option;
  }

  isFormValid() {
    const model = this.formModel();
    return this.config().fields.every((field) => {
      if (!field.required) return true;
      const value = model[field.key];
      return value !== undefined && value !== null && String(value).trim() !== '';
    });
  }
  private async generateInstallCommandForUUID(uuid: string, showSuccess = true) {
    try {
      const response = await this.api.generateInstallCommand(uuid);
      this.generatedInstall.set(response?.data ?? null);
      this.openInstallCommandDialog();
      if (showSuccess) this.snack.success('WebRTC install command generated.');
    } catch (e: any) {
      this.snack.error(e?.error?.error || e?.message || 'Failed to generate install command.');
    }
  }
  async remove(row: WebRtcRecord) {
    const ok = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: 'Delete WebRTC Record',
            message: `Delete ${this.name(row)}?`,
            confirmText: 'Delete',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.api.remove(this.config().resource, this.uuid(row), this.scope());
    this.snack.success('WebRTC record deleted.');
    this.recordsResource.reload();
  }
  async provisionDomain(row: WebRtcRecord) {
    await this.api.provisionDomain(this.uuid(row), this.scope());
    this.snack.success('WebRTC domain provisioning queued on edge agent.');
    this.recordsResource.reload();
  }
  async generateInstallCommand(row: WebRtcRecord) {
    if (this.config().resource !== 'servers') return;
    const ok = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: 'Generate Install Command',
            message: `Generate a new install command for ${this.name(row)}? The previous WebRTC runtime token will be replaced.`,
            confirmText: 'Generate command',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.generateInstallCommandForUUID(this.uuid(row));
  }
  openInstallCommandDialog() {
    const installCommandDialog = this.installCommandDialog();
    if (!installCommandDialog || this.installCommandBinding) return;
    const binding = openCrudTemplateDialog(
      this.dialog,
      installCommandDialog,
      'install-command-dialog-panel',
    );
    this.installCommandBinding = binding;
    bindDialogClosed(binding.ref, () => {
      binding.stop();
      if (this.installCommandBinding === binding) this.installCommandBinding = null;
    });
  }
  installCommand() {
    const data = this.generatedInstall();
    if (!data) return '';
    const apiBase = window.location.origin;
    const installArgs = [
      `--api-base ${this.shellQuote(apiBase)}`,
      `--node-uuid ${this.shellQuote(data['nodeUUID'] || '')}`,
      `--runtime-token ${this.shellQuote(data['runtimeToken'] || '')}`,
    ];
    if (data['publicDomain']) {
      installArgs.push(`--public-domain ${this.shellQuote(String(data['publicDomain']))}`);
    }
    return [
      'sudo install -d -m 0755 /opt/mnscloud',
      'cd /opt/mnscloud',
      '[ -d mnscloud-kamailio-webrtc/.git ] && sudo git -C mnscloud-kamailio-webrtc pull || gh repo clone manaoscloud/mnscloud-kamailio-webrtc',
      `sudo bash /opt/mnscloud/mnscloud-kamailio-webrtc/scripts/install-kamailio-webrtc.sh ${installArgs.join(' ')}`,
      'sudo bash /opt/mnscloud/mnscloud-kamailio-webrtc/scripts/validate-kamailio-webrtc.sh',
    ].join(' && ');
  }
  notifyCommandCopied(copied: boolean) {
    copied
      ? this.snack.success('Install command copied.')
      : this.snack.error('Failed to copy install command.');
  }
  installCommandDetails() {
    const data = this.generatedInstall();
    return [
      { label: 'API base', value: window.location.origin, monospace: true },
      { label: 'Node UUID', value: data?.['nodeUUID'], monospace: true },
      { label: 'Public domain', value: data?.['publicDomain'], monospace: true },
      { label: 'Runtime', value: 'mnscloud-kamailio-webrtc', monospace: true },
    ];
  }
  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
  isSelected(row: WebRtcRecord) {
    return this.selected().has(this.uuid(row));
  }
  toggle(row: WebRtcRecord, checked: boolean) {
    this.selected.update((current) => {
      const next = new Set(current);
      checked ? next.add(this.uuid(row)) : next.delete(this.uuid(row));
      return next;
    });
  }
  toggleVisible(checked: boolean) {
    this.selected.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows()) {
        checked ? next.add(this.uuid(row)) : next.delete(this.uuid(row));
      }
      return next;
    });
  }
  reconcile() {
    const valid = new Set(this.rows().map((row: WebRtcRecord) => this.uuid(row)));
    const current = untracked(() => this.selected());
    const next = new Set([...current].filter((uuid) => valid.has(uuid)));
    if (next.size === current.size && [...next].every((uuid) => current.has(uuid))) return;
    this.selected.set(next);
  }
  async removeSelected() {
    const ids = [...this.selected()];
    if (!ids.length) return;
    const ok = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: 'Delete Selected WebRTC Records',
            message: `Delete ${ids.length} selected record(s)?`,
            confirmText: 'Delete selected',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    const result = await this.api.removeMany(this.config().resource, ids, this.scope());
    const failed = result?.data?.failed ?? [];
    const uuidKey = this.config().uuid;
    const failedIds = new Set(
      failed.map((item: Record<string, string>) => item[uuidKey]).filter(Boolean),
    );
    this.selected.set(new Set([...failedIds].map(String)));
    if (failed.length)
      this.snack.error(`${failed.length} selected WebRTC record(s) could not be deleted.`);
    else this.snack.success('Selected WebRTC records deleted.');
    this.recordsResource.reload();
  }

  private sortRows(rows: WebRtcRecord[]): WebRtcRecord[] {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    const multiplier = direction === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) =>
      String(this.cell(left, active) ?? '').localeCompare(String(this.cell(right, active) ?? '')) *
      multiplier,
    );
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string }; message?: string };
    return maybe?.error?.error || maybe?.message || fallback;
  }
}
