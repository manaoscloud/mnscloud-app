import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClipboardModule } from '@angular/cdk/clipboard';

import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SnackbarService } from '../../../services/snackbar.service';
import { VoipWebRtcService, WebRtcRecord, WebRtcResource, WebRtcScope } from './webrtc.service';
import { TranslocoPipe } from '@jsverse/transloco';

type LookupKey = 'servers' | 'domains';
type LookupOption = { value: string; label: string };
type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'lookup' | 'textarea';
  options?: string[];
  lookup?: LookupKey;
  required?: boolean;
  span?: string;
};

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
  publicDomain: 'Public Domain',
  publicIP: 'Public IP',
  domain: 'VoIP Domain',
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
    uuid: 'VwrUUID',
    name: 'VwrName',
    status: 'VwrStatus',
    columns: ['name', 'engine', 'hostname', 'publicDomain', 'publicIP', 'status', 'lastSeen'],
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'nodeUUID', label: 'Node UUID' },
      {
        key: 'engine',
        label: 'Engine',
        type: 'select',
        options: ['kamailio'],
      },
      { key: 'hostname', label: 'Hostname' },
      { key: 'publicDomain', label: 'Public Domain' },
      { key: 'publicIP', label: 'Public IP' },
      { key: 'privateIP', label: 'Private IP' },
      { key: 'baseUrl', label: 'Base URL' },
      { key: 'version', label: 'Version' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
      { key: 'configJson', label: 'Config JSON', type: 'textarea', span: 'span-4' },
      { key: 'notes', label: 'Notes', type: 'textarea', span: 'span-4' },
    ],
  },
  parameters: {
    resource: 'parameters',
    title: 'WebRTC Parameters',
    subtitle: 'Manage tenant and edge-specific WebRTC runtime parameters.',
    uuid: 'VwpUUID',
    name: 'VwpKey',
    status: 'VwpStatus',
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
    uuid: 'VwdUUID',
    name: 'VdmName',
    status: 'VwdStatus',
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
        key: 'domainUUID',
        label: 'VoIP Domain',
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
  selector: 'app-voip-webrtc',
  standalone: true,
  imports: [
    ClipboardModule,
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
  templateUrl: './webrtc.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./webrtc.scss'],
})
export class VoipWebRtcPage implements AfterViewInit, OnDestroy, OnInit {
  private readonly api = inject(VoipWebRtcService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  readonly currentResource = signal<WebRtcResource>('servers');
  readonly scope = signal<WebRtcScope>('tenant');
  readonly config = computed(() => CONFIGS[this.currentResource()]);
  readonly title = computed(() => this.config().title);
  readonly subtitle = computed(() => this.config().subtitle);
  readonly saving = signal(false);
  readonly editing = signal<WebRtcRecord | null>(null);
  readonly selected = new Set<string>();
  readonly generatedInstall = signal<Record<string, string> | null>(null);
  private readonly appliedSearch = signal('');
  searchInput = '';
  search = '';
  readonly dataSource = new MatTableDataSource<WebRtcRecord>([]);
  readonly displayedColumns = computed(() => ['select', ...this.config().columns, 'actions']);
  readonly lookups: Record<LookupKey, LookupOption[]> = { servers: [], domains: [] };
  readonly lookupSearch: Record<LookupKey, string> = { servers: '', domains: '' };
  form = this.fb.group({});
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  readonly installCommandDialog = viewChild<TemplateRef<unknown>>('installCommandDialog');
  private dialogRef: MatDialogRef<unknown> | null = null;
  private binding: CrudDialogBinding | null = null;
  private viewReady = false;

  private readonly recordsResource = resource({
    params: () => ({
      resource: this.config().resource,
      scope: this.scope(),
      search: this.appliedSearch(),
    }),
    defaultValue: [] as WebRtcRecord[],
    loader: async ({ params }) => {
      const res = await this.api.list(
        params.resource,
        {
          limit: 5000,
          search: params.search,
        },
        params.scope,
      );
      return res?.data?.items ?? [];
    },
  });

  readonly loading = this.recordsResource.isLoading;

  private readonly syncTableData = effect(() => {
    this.dataSource.data = this.recordsResource.value();
    this.reconcile();
  });

  private readonly reportLoadError = effect(() => {
    const error = this.recordsResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load WebRTC records.'));
  });

  ngOnInit() {
    this.route.data
      .pipe(takeUntilDestroyed())
      .subscribe((data) => {
        this.currentResource.set((data['resource'] ?? 'servers') as WebRtcResource);
        this.scope.set(data['scope'] === 'master' ? 'master' : 'tenant');
        this.searchInput = '';
        this.search = '';
        this.dataSource.filter = '';
        this.selected.clear();
        if (this.viewReady) this.recordsResource.reload();
      });
  }
  ngAfterViewInit() {
    this.viewReady = true;
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.filterPredicate = (row, filter) =>
      JSON.stringify(row).toLowerCase().includes(filter);
    this.dataSource.sortingDataAccessor = (row, column) =>
      String(this.cell(row, column) ?? '').toLowerCase();
  }
  ngOnDestroy() {
    this.binding?.stop();
  }
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
      engine: row['VwrEngine'],
      hostname: row['VwrHostname'],
      publicDomain: row['VwrPublicDomain'],
      publicIP: row['VwrPublicIP'],
      version: row['VwrVersion'],
      lastSeen: row['VwrLastSeenAt'],
      server: row['VwrName'],
      domain: row['VdmName'],
      certificateProvider: row['VwdCertificateProvider'],
      nginxStatus: row['VwdNginxStatus'],
      certificateStatus: row['VwdCertificateStatus'],
      autoProvision: Number(row['VwdAutoProvision'] ?? 0) === 1 ? 'YES' : 'NO',
      key: row['VwpKey'],
      value: this.displayValue(row['VwpValue']),
      type: row['VwpType'],
      description: row['VwpDescription'],
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
    this.search = this.searchInput.trim();
    this.dataSource.filter = this.search.toLowerCase();
    this.paginator()?.firstPage();
    this.appliedSearch.set(this.search);
  }
  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.dataSource.filter = '';
    this.paginator()?.firstPage();
    this.appliedSearch.set('');
  }
  async loadLookups() {
    const needs = new Set(
      this.config()
        .fields.map((field) => field.lookup)
        .filter(Boolean) as LookupKey[],
    );
    await Promise.all(
      [...needs].map(async (key) => {
        const res =
          key === 'domains'
            ? await this.api.listVoipDomains(this.scope(), { limit: 5000 })
            : this.config().resource === 'domains' && key === 'servers' && this.scope() === 'tenant'
              ? await this.api.listServerOptions()
              : await this.api.list(key, { limit: 5000 }, 'master');
        const rows = res?.data?.items ?? [];
        this.lookups[key] = rows
          .map((row: WebRtcRecord) => ({
            value: String(key === 'domains' ? (row['VdmUUID'] ?? '') : (row['VwrUUID'] ?? '')),
            label: String(key === 'domains' ? (row['VdmName'] ?? '') : (row['VwrName'] ?? '')),
          }))
          .filter((option: LookupOption) => option.value);
      }),
    );
  }
  filteredLookup(key: LookupKey) {
    const term = this.lookupSearch[key].trim().toLowerCase();
    if (!term) return this.lookups[key];
    return this.lookups[key].filter((option) =>
      `${option.label} ${option.value}`.toLowerCase().includes(term),
    );
  }
  clearLookupSearch(opened: boolean, key: LookupKey) {
    if (!opened) this.lookupSearch[key] = '';
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
    const group: Record<string, any> = {};
    for (const f of this.config().fields)
      group[f.key] = [this.valueForField(f.key, row), f.required ? [Validators.required] : []];
    this.form = this.fb.group(group);
  }
  valueForField(key: string, row?: WebRtcRecord | null) {
    if (!row) {
      if (key === 'status') return 'active';
      if (key === 'engine' && this.config().resource === 'servers') return 'kamailio';
      return '';
    }
    const m: Record<string, string> = {
      name: this.config().name,
      engine: 'VwrEngine',
      nodeUUID: 'VwrNodeUUID',
      hostname: 'VwrHostname',
      publicDomain: 'VwrPublicDomain',
      publicIP: 'VwrPublicIP',
      privateIP: 'VwrPrivateIP',
      baseUrl: 'VwrBaseUrl',
      version: 'VwrVersion',
      serverUUID: 'VoipWebRtcServerVwrUUID',
      domainUUID: 'VoipDomainVdmUUID',
      certificateProvider: 'VwdCertificateProvider',
      autoProvision: 'VwdAutoProvision',
      key: 'VwpKey',
      type: 'VwpType',
      description: 'VwpDescription',
    };
    if (key === 'status') return this.status(row) ? 'active' : 'inactive';
    if (key === 'autoProvision')
      return Number(row['VwdAutoProvision'] ?? 1) === 1 ? 'active' : 'inactive';
    if (key === 'notes') {
      return this.config().resource === 'domains'
        ? (row['VwdNotes'] ?? '')
        : (row['VwrNotes'] ?? '');
    }
    if (key === 'configJson') return JSON.stringify(row['VwrConfig'] ?? {}, null, 2);
    if (key === 'valueJson') return this.displayValue(row['VwpValue']);
    return row[m[key]] ?? '';
  }
  async startCreate() {
    this.editing.set(null);
    await this.loadLookups();
    this.buildForm(null);
    this.openDialog();
  }
  async startEdit(row: WebRtcRecord) {
    this.editing.set(row);
    await this.loadLookups();
    this.buildForm(row);
    this.openDialog();
  }
  openDialog() {
    const formDialog = this.formDialog();
    if (!formDialog) return;
    this.binding = openCrudTemplateDialog(this.dialog, formDialog, 'voip-webrtc-form-dialog', {
      onEscape: () => this.closeDialog(),
    });
    this.dialogRef = this.binding.ref;
  }
  closeDialog() {
    this.dialogRef?.close();
    this.dialogRef = null;
    this.binding?.stop();
    this.binding = null;
    this.saving.set(false);
  }
  payload() {
    const raw = this.form.getRawValue() as Record<string, any>;
    const p: Record<string, any> = { ...raw, status: raw['status'] === 'inactive' ? 0 : 1 };
    if ('autoProvision' in raw) p['autoProvision'] = raw['autoProvision'] === 'inactive' ? 0 : 1;
    if (this.config().resource === 'servers') p['engine'] = 'kamailio';
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
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
    if (!installCommandDialog) return;
    this.dialog.open(installCommandDialog, {
      width: 'min(860px, calc(100vw - 32px))',
      maxWidth: '860px',
      disableClose: false,
    });
  }
  installCommand() {
    const data = this.generatedInstall();
    if (!data) return '';
    const apiBase = window.location.origin;
    const refreshAgentCommand = `[ ! -x /opt/mnscloud/mnscloud-agent/scripts/update-agent.sh ] || sudo bash /opt/mnscloud/mnscloud-agent/scripts/update-agent.sh --api-base ${this.shellQuote(apiBase)} --install-label "$(hostname -f 2>/dev/null || hostname)"`;
    return [
      'sudo install -d -m 0755 /opt/mnscloud',
      'cd /opt/mnscloud',
      '[ -d mnscloud-kamailio-webrtc/.git ] && sudo git -C mnscloud-kamailio-webrtc pull || gh repo clone manaoscloud/mnscloud-kamailio-webrtc',
      `sudo bash /opt/mnscloud/mnscloud-kamailio-webrtc/scripts/install-kamailio-webrtc.sh --api-base ${this.shellQuote(apiBase)} --node-uuid ${this.shellQuote(data['nodeUUID'] || '')} --runtime-token ${this.shellQuote(data['runtimeToken'] || '')}`,
      refreshAgentCommand,
      'sudo bash /opt/mnscloud/mnscloud-kamailio-webrtc/scripts/validate-kamailio-webrtc.sh',
    ].join(' && ');
  }
  notifyCommandCopied(copied: boolean) {
    copied
      ? this.snack.success('Install command copied.')
      : this.snack.error('Failed to copy install command.');
  }
  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
  isSelected(row: WebRtcRecord) {
    return this.selected.has(this.uuid(row));
  }
  toggle(row: WebRtcRecord, checked: boolean) {
    checked ? this.selected.add(this.uuid(row)) : this.selected.delete(this.uuid(row));
  }
  visibleRows() {
    const rows = this.dataSource.filteredData;
    const paginator = this.paginator();
    if (!paginator) return rows;
    const start = paginator.pageIndex * paginator.pageSize;
    return rows.slice(start, start + paginator.pageSize);
  }
  allVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((r) => this.selected.has(this.uuid(r)));
  }
  someVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((r) => this.selected.has(this.uuid(r))) && !this.allVisibleSelected();
  }
  toggleVisible(checked: boolean) {
    for (const r of this.visibleRows()) this.toggle(r, checked);
  }
  reconcile() {
    const valid = new Set(this.dataSource.data.map((r) => this.uuid(r)));
    for (const id of [...this.selected]) if (!valid.has(id)) this.selected.delete(id);
  }
  async removeSelected() {
    const ids = [...this.selected];
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
    this.selected.clear();
    for (const id of failedIds) this.selected.add(String(id));
    if (failed.length)
      this.snack.error(`${failed.length} selected WebRTC record(s) could not be deleted.`);
    else this.snack.success('Selected WebRTC records deleted.');
    this.recordsResource.reload();
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string }; message?: string };
    return maybe?.error?.error || maybe?.message || fallback;
  }
}
