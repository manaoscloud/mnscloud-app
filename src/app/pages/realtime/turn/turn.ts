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
import { ClipboardModule } from '@angular/cdk/clipboard';
import { FormField, form as createForm, type Field as SignalField } from '@angular/forms/signals';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { SnackbarService } from '../../../services/snackbar.service';
import { bindDialogClosed } from '../../../shared/dialog/dialog-events.util';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import {
  MnsSearchSelectFieldComponent,
  MnsSelectFieldComponent,
  MnsStatusSelectFieldComponent,
  MnsTextFieldComponent,
  MnsTextareaFieldComponent,
  type MnsSearchSelectFieldOption,
  type MnsSelectFieldOption,
} from '../../../shared/forms';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { RealtimeTurnService, TurnRecord, TurnResource, TurnScope } from './turn.service';

type FieldType = 'text' | 'number' | 'select' | 'domain' | 'textarea';
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
type TurnFormModel = {
  status: number;
  serverUUID: string;
  realtimeDomainUUID: string;
  name: string;
  nodeUUID: string;
  hostname: string;
  publicIP: string;
  privateIP: string;
  listeningIP: string;
  externalIP: string;
  listeningPort: number | string;
  tlsListeningPort: number | string;
  minRelayPort: number | string;
  maxRelayPort: number | string;
  totalQuota: number | string;
  bpsCapacity: number | string;
  certificateProvider: string;
  autoProvision: number;
  tlsCertPath: string;
  tlsKeyPath: string;
  configJson: string;
  notes: string;
};

const STATUS_OPTIONS = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const CERTIFICATE_PROVIDER_OPTIONS = [
  { value: 'letsencrypt', label: 'Let’s Encrypt' },
  { value: 'manual', label: 'Manual' },
  { value: 'self_signed', label: 'Self-signed' },
  { value: 'none', label: 'None' },
];

const RECORD_FIELDS: Field[] = [
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
  { key: 'name', label: 'Name', required: true },
  { key: 'realtimeDomainUUID', label: 'Primary Realm Domain', type: 'domain' },
  { key: 'nodeUUID', label: 'Node UUID' },
  { key: 'hostname', label: 'Hostname' },
  { key: 'publicIP', label: 'Public IP' },
  { key: 'privateIP', label: 'Private IP' },
];

const DOMAIN_RECORD_FIELDS: Field[] = [
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
  { key: 'serverUUID', label: 'Server', type: 'select', required: true },
  { key: 'realtimeDomainUUID', label: 'Realtime Domain', type: 'domain', required: true },
  {
    key: 'certificateProvider',
    label: 'Certificate Provider',
    type: 'select',
    options: CERTIFICATE_PROVIDER_OPTIONS,
  },
  {
    key: 'autoProvision',
    label: 'Auto Provision',
    type: 'select',
    options: STATUS_OPTIONS,
  },
];

const NETWORK_FIELDS: Field[] = [
  { key: 'listeningIP', label: 'Listening IP' },
  { key: 'externalIP', label: 'External IP' },
  { key: 'listeningPort', label: 'Listening Port', type: 'number' },
  { key: 'tlsListeningPort', label: 'TLS Listening Port', type: 'number' },
  { key: 'minRelayPort', label: 'Min Relay Port', type: 'number' },
  { key: 'maxRelayPort', label: 'Max Relay Port', type: 'number' },
  { key: 'totalQuota', label: 'Total Quota', type: 'number' },
  { key: 'bpsCapacity', label: 'BPS Capacity', type: 'number' },
];

const CERTIFICATE_FIELDS: Field[] = [
  {
    key: 'certificateProvider',
    label: 'Certificate Provider',
    type: 'select',
    options: CERTIFICATE_PROVIDER_OPTIONS,
  },
  { key: 'tlsCertPath', label: 'TLS Cert Path' },
  { key: 'tlsKeyPath', label: 'TLS Key Path' },
];

const DOMAIN_CERTIFICATE_FIELDS: Field[] = [
  { key: 'tlsCertPath', label: 'TLS Cert Path' },
  { key: 'tlsKeyPath', label: 'TLS Key Path' },
];

const NOTES_FIELDS: Field[] = [
  { key: 'configJson', label: 'Config JSON', type: 'textarea', span: 'span-4', rows: 8 },
  { key: 'notes', label: 'Notes', type: 'textarea', span: 'span-4', rows: 4 },
];

const DOMAIN_NOTES_FIELDS: Field[] = [
  { key: 'notes', label: 'Notes', type: 'textarea', span: 'span-4', rows: 4 },
];

@Component({
  selector: 'app-realtime-turn',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MnsSearchSelectFieldComponent,
    MnsSelectFieldComponent,
    MnsStatusSelectFieldComponent,
    MnsTextFieldComponent,
    MnsTextareaFieldComponent,
    ClipboardModule,
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
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './turn.html',
  styleUrls: ['./turn.scss'],
})
export class RealtimeTurnPage {
  private readonly api = inject(RealtimeTurnService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snack = inject(SnackbarService);

  readonly searchInput = signal('');
  private readonly appliedSearch = signal('');
  readonly saving = signal(false);
  readonly mutating = signal(false);
  readonly editing = signal<TurnRecord | null>(null);
  readonly selected = signal<Set<string>>(new Set());
  readonly generatedInstall = signal<TurnRecord | null>(null);
  readonly generatedInstallSource = signal<TurnRecord | null>(null);
  readonly domainLookupEnabled = signal(false);
  readonly serverOptions = signal<TurnRecord[]>([]);
  private readonly routeData = toSignal(this.route.data, { initialValue: {} });

  readonly currentResource = computed<TurnResource>(() => {
    const resource = (this.routeData() as Record<string, unknown>)['resource'];
    return resource === 'domains' ? 'domains' : 'servers';
  });
  readonly scope = computed<TurnScope>(() => {
    const scope = (this.routeData() as Record<string, unknown>)['scope'];
    return scope === 'tenant' ? 'tenant' : 'master';
  });
  readonly isDomains = computed(() => this.currentResource() === 'domains');
  readonly formModel = signal<TurnFormModel>(this.defaultFormModel());
  readonly form = createForm(this.formModel);
  readonly pageTitle = computed(() =>
    this.isDomains() ? 'TURN/STUN Domains' : 'TURN/STUN Servers',
  );
  readonly pageSubtitle = computed(() =>
    this.isDomains()
      ? 'Assign realtime TURN/STUN domains to managed coturn edge nodes.'
      : 'Register dedicated coturn relay servers for realtime media traversal.',
  );

  readonly dataSource = new MatTableDataSource<TurnRecord>([]);
  readonly displayedColumns = computed(() =>
    this.isDomains()
      ? [
          'select',
          'domain',
          'server',
          'certificateProvider',
          'provisionStatus',
          'certificateStatus',
          'status',
          'actions',
        ]
      : [
          'select',
          'name',
          'domain',
          'externalIP',
          'ports',
          'certificateProvider',
          'status',
          'lastSeen',
          'actions',
        ],
  );

  readonly recordFields = computed(() => (this.isDomains() ? DOMAIN_RECORD_FIELDS : RECORD_FIELDS));
  readonly networkFields = computed(() => (this.isDomains() ? [] : NETWORK_FIELDS));
  readonly certificateFields = computed(() =>
    this.isDomains() ? DOMAIN_CERTIFICATE_FIELDS : CERTIFICATE_FIELDS,
  );
  readonly notesFields = computed(() => (this.isDomains() ? DOMAIN_NOTES_FIELDS : NOTES_FIELDS));

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly turnFormDialog = viewChild<TemplateRef<unknown>>('turnFormDialog');
  readonly installCommandDialog = viewChild<TemplateRef<unknown>>('installCommandDialog');

  private dialogRef: MatDialogRef<unknown> | null = null;
  private binding: CrudDialogBinding | null = null;

  private readonly itemsResource = resource({
    params: () => ({
      resource: this.currentResource(),
      scope: this.scope(),
      search: this.appliedSearch(),
    }),
    defaultValue: [] as TurnRecord[],
    loader: async ({ params }) => {
      const response = await this.api.list(
        params.resource,
        { limit: 5000, search: params.search },
        params.scope,
      );
      return response?.data?.items ?? [];
    },
  });

  private readonly domainsResource = resource({
    params: () => ({
      enabled: this.isDomains() || this.domainLookupEnabled(),
      resource: this.currentResource(),
      scope: this.scope(),
    }),
    defaultValue: [] as TurnRecord[],
    loader: async ({ params }) => {
      if (!params.enabled) return [];
      const response =
        params.resource === 'domains'
          ? await this.api.listRealtimeDomains(
              {
                purpose: 'turn',
                status: 1,
                limit: 5000,
              },
              params.scope,
            )
          : await this.api.listTurnDomainOptions(params.scope);
      return response?.data?.items ?? [];
    },
  });

  readonly domainOptions = computed(() => this.domainsResource.value());
  readonly domainSelectOptions = computed<MnsSearchSelectFieldOption[]>(() => {
    const fromRealtimeDomain = this.isDomains();
    return this.domainOptions()
      .map((domain: TurnRecord) => {
        const value = fromRealtimeDomain
          ? domain['RtdUUID']
          : domain['RealtimeDomainRtdUUID'];
        const label = domain['RtdName'] || domain['DomainName'] || value;
        const server = domain['RtsName'] || domain['ServerName'] || '';
        return {
          value: String(value ?? ''),
          label: String(label ?? ''),
          searchText: `${label ?? ''} ${server} ${domain['RtnUUID'] ?? ''} ${value ?? ''}`,
        };
      })
      .filter((option: MnsSearchSelectFieldOption) => option.value);
  });

  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.filterPredicate = (row, filter) =>
      JSON.stringify(row).toLowerCase().includes(filter);
    this.dataSource.sortingDataAccessor = (row, column) =>
      String(this.cell(row, column) ?? '').toLowerCase();
  });

  private readonly syncRows = effect(() => {
    this.dataSource.data = this.itemsResource.value();
    this.reconcileSelection();
  });

  private readonly reportLoadError = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, `Failed to load ${this.pageTitle()}.`));
  });

  private readonly loadServerOptions = effect(() => {
    if (!this.isDomains()) return;
    this.api
      .listServerOptions(this.scope())
      .then((response) => this.serverOptions.set(response?.data?.items ?? []))
      .catch(() => this.serverOptions.set([]));
  });

  private readonly cleanup = this.destroyRef.onDestroy(() => this.closeDialog());

  refreshList(): void {
    this.itemsResource.reload();
  }

  applySearchFilters(): void {
    const nextSearch = this.searchInput().trim();
    this.dataSource.filter = nextSearch.toLowerCase();
    this.paginator()?.firstPage();
    if (nextSearch === this.appliedSearch()) {
      this.itemsResource.reload();
    } else {
      this.appliedSearch.set(nextSearch);
    }
  }

  clearSearchFilters(): void {
    this.searchInput.set('');
    this.dataSource.filter = '';
    this.paginator()?.firstPage();
    if (this.appliedSearch()) {
      this.appliedSearch.set('');
    } else {
      this.itemsResource.reload();
    }
  }

  startCreate(): void {
    this.editing.set(null);
    this.formModel.set(this.defaultFormModel());
    this.openDialog();
  }

  startEdit(row: TurnRecord): void {
    this.editing.set(row);
    this.formModel.set(this.formModelFromRow(row));
    this.openDialog();
  }

  openDialog(): void {
    const template = this.turnFormDialog();
    if (!template) return;
    this.binding = openCrudTemplateDialog(this.dialog, template, 'realtime-turn-form-dialog', {
      onEscape: () => this.closeDialog(),
    });
    this.dialogRef = this.binding.ref;
    this.domainLookupEnabled.set(true);
    bindDialogClosed(this.dialogRef, () => {
      this.binding?.stop();
      this.binding = null;
      this.dialogRef = null;
      this.domainLookupEnabled.set(false);
      this.saving.set(false);
    });
  }

  closeDialog(): void {
    this.dialogRef?.close();
    this.dialogRef = null;
    this.binding?.stop();
    this.binding = null;
    this.domainLookupEnabled.set(false);
    this.saving.set(false);
  }

  async submit(saveAndNew = false): Promise<void> {
    if (!this.isFormValid()) return;
    this.saving.set(true);
    try {
      const row = this.editing();
      if (row) {
        await this.api.update(this.currentResource(), this.uuid(row), this.payload(), this.scope());
        this.snack.success(`${this.itemLabel()} updated.`);
      } else {
        const response = await this.api.create(
          this.currentResource(),
          this.payload(),
          this.scope(),
        );
        this.snack.success(`${this.itemLabel()} created.`);
        if (!saveAndNew) {
          const item = response?.data?.item ?? null;
          this.closeDialog();
          if (!this.isDomains() && item?.RtsUUID)
            await this.generateInstallCommandForUUID(String(item.RtsUUID), item, false);
          this.itemsResource.reload();
          return;
        }
      }

      this.itemsResource.reload();
      if (saveAndNew && !row) {
        this.editing.set(null);
        this.formModel.set(this.defaultFormModel());
      } else {
        this.closeDialog();
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error, `Failed to save ${this.itemLabel()}.`));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(row: TurnRecord): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: `Delete ${this.itemLabel()}`,
            message: `Delete ${this.name(row)}?`,
            confirmText: 'Delete',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.runMutation(async () => {
      await this.api.remove(this.currentResource(), this.uuid(row), this.scope());
      this.snack.success(`${this.itemLabel()} deleted.`);
      this.itemsResource.reload();
    });
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
            title: `Delete Selected ${this.pageTitle()}`,
            message: `Delete ${ids.length} selected record(s)?`,
            confirmText: 'Delete selected',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.runMutation(async () => {
      const result = await this.api.removeMany(this.currentResource(), ids, this.scope());
      const failed = result?.data?.failed ?? [];
      const failedIds = new Set<string>(
        failed.map((item: any) => String(item.uuid ?? '')).filter(Boolean),
      );
      this.selected.set(failedIds);
      if (failed.length) {
        this.snack.error(`${failed.length} selected record(s) could not be deleted.`);
      } else {
        this.snack.success(`Selected ${this.pageTitle()} deleted.`);
      }
      this.itemsResource.reload();
    });
  }

  async generateInstallCommand(row: TurnRecord): Promise<void> {
    if (this.isDomains()) return;
    const ok = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: 'Generate Install Command',
            message: `Generate a new install command for ${this.name(row)}? The previous TURN/STUN runtime token will be replaced.`,
            confirmText: 'Generate command',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.generateInstallCommandForUUID(this.uuid(row), row);
  }

  async provisionDomain(row: TurnRecord): Promise<void> {
    if (!this.isDomains()) return;
    await this.runMutation(async () => {
      await this.api.provisionDomain(this.uuid(row), this.scope());
      this.snack.success('TURN/STUN domain provisioning queued.');
      this.itemsResource.reload();
    });
  }

  private async generateInstallCommandForUUID(
    uuid: string,
    source: TurnRecord | null,
    showSuccess = true,
  ): Promise<void> {
    try {
      const response = await this.api.generateInstallCommand(uuid);
      this.generatedInstall.set(response?.data ?? null);
      this.generatedInstallSource.set(source);
      this.openInstallCommandDialog();
      if (showSuccess) this.snack.success('TURN/STUN install command generated.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to generate TURN/STUN install command.'));
    }
  }

  openInstallCommandDialog(): void {
    const template = this.installCommandDialog();
    if (!template) return;
    this.dialog.open(template, {
      width: 'min(920px, calc(100vw - 32px))',
      maxWidth: '920px',
      disableClose: false,
    });
  }

  installCommand(): string {
    const token = this.generatedInstall();
    const source = this.generatedInstallSource();
    if (!token) return '';
    const apiBase = window.location.origin;
    const args = [
      '--non-interactive',
      '--api-base',
      this.shellQuote(apiBase),
      '--node-uuid',
      this.shellQuote(String(token['nodeUUID'] ?? '')),
      '--runtime-token',
      this.shellQuote(String(token['runtimeToken'] ?? '')),
      '--realm',
      this.shellQuote(
        String(token['realm'] || source?.['RtdName'] || source?.['DomainName'] || ''),
      ),
      '--listening-ip',
      this.shellQuote(String(source?.['RtsListeningIP'] || '0.0.0.0')),
      '--listening-port',
      this.shellQuote(String(source?.['RtsListeningPort'] || '3478')),
      '--tls-listening-port',
      this.shellQuote(String(source?.['RtsTlsListeningPort'] || '5349')),
      '--min-relay-port',
      this.shellQuote(String(source?.['RtsMinRelayPort'] || '49152')),
      '--max-relay-port',
      this.shellQuote(String(source?.['RtsMaxRelayPort'] || '65535')),
    ];
    const externalIP = String(token['externalIP'] || source?.['RtsExternalIP'] || '').trim();
    if (externalIP) args.push('--external-ip', this.shellQuote(externalIP));
    const tlsCert = String(source?.['RtsTlsCertPath'] || '').trim();
    const tlsKey = String(source?.['RtsTlsKeyPath'] || '').trim();
    if (tlsCert && tlsKey)
      args.push('--tls-cert', this.shellQuote(tlsCert), '--tls-key', this.shellQuote(tlsKey));

    return [
      'sudo install -d -m 0755 /opt/mnscloud',
      'cd /opt/mnscloud',
      '[ -d mnscloud-turn/.git ] && sudo git -C mnscloud-turn pull || gh repo clone manaoscloud/mnscloud-turn',
      `sudo bash /opt/mnscloud/mnscloud-turn/scripts/install-turn.sh ${args.join(' ')}`,
      'sudo bash /opt/mnscloud/mnscloud-turn/scripts/validate-turn.sh',
    ].join(' && ');
  }

  notifyCommandCopied(copied: boolean): void {
    copied
      ? this.snack.success('Install command copied.')
      : this.snack.error('Failed to copy install command.');
  }

  formField(key: keyof TurnFormModel | string): SignalFormField {
    return (this.form as any)[key];
  }

  selectOptions(field: Field): MnsSelectFieldOption[] {
    return field.options ?? [];
  }

  isFormValid(): boolean {
    const model = this.formModel() as Record<string, unknown>;
    return this.recordFields().every((field) => {
      if (!field.required) return true;
      const value = model[field.key];
      return value !== undefined && value !== null && String(value).trim() !== '';
    });
  }

  uuid(row: TurnRecord): string {
    return String(this.isDomains() ? (row['RtnUUID'] ?? '') : (row['RtsUUID'] ?? ''));
  }

  name(row: TurnRecord): string {
    return String(
      this.isDomains() ? (row['RtdName'] ?? row['DomainName'] ?? '') : (row['RtsName'] ?? ''),
    );
  }

  status(row: TurnRecord): boolean {
    return Number(this.isDomains() ? (row['RtnStatus'] ?? 0) : (row['RtsStatus'] ?? 0)) === 1;
  }

  cell(row: TurnRecord, column: string): string {
    const map: Record<string, any> = {
      name: row['RtsName'],
      domain: row['RtdName'] ?? row['DomainName'],
      externalIP: row['RtsExternalIP'] || row['RtsPublicIP'],
      ports: `${row['RtsListeningPort'] ?? 3478} / ${row['RtsTlsListeningPort'] ?? 5349}`,
      certificateProvider: this.isDomains()
        ? row['RtnCertificateProvider']
        : row['RtsCertificateProvider'],
      server: row['RtsName'],
      provisionStatus: row['RtnProvisionStatus'],
      certificateStatus: row['RtnCertificateStatus'],
      status: this.status(row) ? 'ACTIVE' : 'INACTIVE',
      lastSeen: row['RtsLastSeenAt'] || '-',
    };
    return String(map[column] ?? '');
  }

  columnLabel(column: string): string {
    const labels: Record<string, string> = {
      name: 'Name',
      domain: 'Domain',
      server: 'Server',
      externalIP: 'External IP',
      ports: 'Ports',
      certificateProvider: 'Certificate',
      provisionStatus: 'Provisioning',
      certificateStatus: 'TLS',
      status: 'Status',
      lastSeen: 'Last Seen',
      actions: 'Actions',
    };
    return labels[column] ?? column;
  }

  isSelected(row: TurnRecord): boolean {
    return this.selected().has(this.uuid(row));
  }

  toggle(row: TurnRecord, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      checked ? next.add(this.uuid(row)) : next.delete(this.uuid(row));
      return next;
    });
  }

  visibleRows(): TurnRecord[] {
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
    const rows = this.visibleRows();
    this.selected.update((current) => {
      const next = new Set(current);
      for (const row of rows) {
        checked ? next.add(this.uuid(row)) : next.delete(this.uuid(row));
      }
      return next;
    });
  }

  private reconcileSelection(): void {
    const valid = new Set(this.dataSource.data.map((row) => this.uuid(row)));
    const current = untracked(() => this.selected());
    const next = new Set([...current].filter((uuid) => valid.has(uuid)));
    if (next.size === current.size && [...next].every((uuid) => current.has(uuid))) return;
    this.selected.set(next);
  }

  private defaultFormModel(): TurnFormModel {
    const base: TurnFormModel = {
      status: 1,
      serverUUID: '',
      name: '',
      realtimeDomainUUID: '',
      nodeUUID: '',
      hostname: '',
      publicIP: '',
      privateIP: '',
      listeningIP: '0.0.0.0',
      externalIP: '',
      listeningPort: 3478,
      tlsListeningPort: 5349,
      minRelayPort: 49152,
      maxRelayPort: 65535,
      totalQuota: 1000,
      bpsCapacity: 0,
      certificateProvider: 'letsencrypt',
      autoProvision: 1,
      tlsCertPath: '',
      tlsKeyPath: '',
      configJson: '{}',
      notes: '',
    };
    if (this.isDomains()) {
      return {
        ...base,
        certificateProvider: 'letsencrypt',
        autoProvision: 1,
        configJson: '',
      };
    }
    return base;
  }

  private formModelFromRow(row: TurnRecord): TurnFormModel {
    const base = this.defaultFormModel();
    if (this.isDomains()) {
      return {
        ...base,
        status: Number(row['RtnStatus'] ?? 1),
        serverUUID: row['RealtimeTurnServerRtsUUID'] ?? '',
        realtimeDomainUUID: row['RealtimeDomainRtdUUID'] ?? '',
        certificateProvider: row['RtnCertificateProvider'] ?? 'letsencrypt',
        autoProvision: Number(row['RtnAutoProvision'] ?? 1),
        tlsCertPath: row['RtnTlsCertPath'] ?? '',
        tlsKeyPath: row['RtnTlsKeyPath'] ?? '',
        notes: row['RtnNotes'] ?? '',
      };
    }
    return {
      ...base,
      status: Number(row['RtsStatus'] ?? 1),
      name: row['RtsName'] ?? '',
      realtimeDomainUUID: row['RealtimeDomainRtdUUID'] ?? '',
      nodeUUID: row['RtsNodeUUID'] ?? '',
      hostname: row['RtsHostname'] ?? '',
      publicIP: row['RtsPublicIP'] ?? '',
      privateIP: row['RtsPrivateIP'] ?? '',
      listeningIP: row['RtsListeningIP'] ?? '0.0.0.0',
      externalIP: row['RtsExternalIP'] ?? '',
      listeningPort: row['RtsListeningPort'] ?? 3478,
      tlsListeningPort: row['RtsTlsListeningPort'] ?? 5349,
      minRelayPort: row['RtsMinRelayPort'] ?? 49152,
      maxRelayPort: row['RtsMaxRelayPort'] ?? 65535,
      totalQuota: row['RtsTotalQuota'] ?? 1000,
      bpsCapacity: row['RtsBpsCapacity'] ?? 0,
      certificateProvider: row['RtsCertificateProvider'] ?? 'letsencrypt',
      tlsCertPath: row['RtsTlsCertPath'] ?? '',
      tlsKeyPath: row['RtsTlsKeyPath'] ?? '',
      configJson: JSON.stringify(row['RtsConfig'] ?? {}, null, 2),
      notes: row['RtsNotes'] ?? '',
    };
  }

  private payload(): TurnRecord {
    const raw = this.formModel();
    const payload: TurnRecord = {
      ...raw,
      status: Number(raw['status'] ?? 1),
      listeningPort: this.numberOrNull(raw['listeningPort']),
      tlsListeningPort: this.numberOrNull(raw['tlsListeningPort']),
      minRelayPort: this.numberOrNull(raw['minRelayPort']),
      maxRelayPort: this.numberOrNull(raw['maxRelayPort']),
      totalQuota: this.numberOrNull(raw['totalQuota']),
      bpsCapacity: this.numberOrNull(raw['bpsCapacity']),
    };
    if (raw['configJson']) {
      try {
        payload['config'] = JSON.parse(raw['configJson']);
      } catch {
        payload['config'] = raw['configJson'];
      }
    }
    delete payload['configJson'];
    return payload;
  }

  itemLabel(): string {
    return this.isDomains() ? 'TURN/STUN domain' : 'TURN/STUN server';
  }

  private numberOrNull(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async runMutation(action: () => Promise<void>): Promise<void> {
    this.mutating.set(true);
    try {
      await action();
    } finally {
      this.mutating.set(false);
    }
  }

  private shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private errorMessage(error: unknown, fallback: string): string {
    const maybe = error as { error?: { error?: string }; message?: string };
    return maybe?.error?.error || maybe?.message || fallback;
  }
}
