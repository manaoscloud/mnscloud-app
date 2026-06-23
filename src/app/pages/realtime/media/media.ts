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
import { form as createForm, type Field as SignalField } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { SnackbarService } from '../../../services/snackbar.service';
import { bindDialogClosed } from '../../../shared/dialog/dialog-events.util';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
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
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { RealtimeMediaService, MediaRecord, type MediaResource } from './media.service';

type FieldType = 'text' | 'number' | 'select' | 'domain' | 'mediaDomain' | 'textarea';
type Field = {
  key: keyof MediaFormModel;
  label: string;
  type?: FieldType;
  required?: boolean;
  span?: string;
  rows?: number;
  options?: { value: string | number; label: string }[];
};
type SignalFormField = SignalField<any, any>;
type MediaFormModel = {
  status: number;
  name: string;
  engine: string;
  mediaDomainUUID: string;
  realtimeDomainUUID: string;
  nodeUUID: string;
  hostname: string;
  publicIP: string;
  privateIP: string;
  controlIP: string;
  controlPort: number | string;
  minMediaPort: number | string;
  maxMediaPort: number | string;
  version: string;
  configJson: string;
  notes: string;
};

const STATUS_OPTIONS = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const ENGINE_OPTIONS = [
  { value: 'rtpengine', label: 'rtpengine' },
  { value: 'custom', label: 'Custom' },
];

const RECORD_FIELDS: Field[] = [
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
  { key: 'engine', label: 'Engine', type: 'select', options: ENGINE_OPTIONS },
  { key: 'name', label: 'Name', required: true },
  { key: 'mediaDomainUUID', label: 'Media Domain', type: 'mediaDomain' },
  { key: 'nodeUUID', label: 'Node UUID' },
  { key: 'hostname', label: 'Hostname' },
  { key: 'publicIP', label: 'Public IP' },
  { key: 'privateIP', label: 'Private IP' },
];

const DOMAIN_RECORD_FIELDS: Field[] = [
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
  { key: 'realtimeDomainUUID', label: 'Realtime Domain', type: 'domain', required: true },
];

const DOMAIN_NOTES_FIELDS: Field[] = [
  { key: 'notes', label: 'Notes', type: 'textarea', span: 'span-4', rows: 8 },
];

const NETWORK_FIELDS: Field[] = [
  { key: 'controlIP', label: 'Control IP' },
  { key: 'controlPort', label: 'Control Port', type: 'number' },
  { key: 'minMediaPort', label: 'Min Media Port', type: 'number' },
  { key: 'maxMediaPort', label: 'Max Media Port', type: 'number' },
  { key: 'version', label: 'Version' },
];

const NOTES_FIELDS: Field[] = [
  { key: 'configJson', label: 'Config JSON', type: 'textarea', span: 'span-4', rows: 8 },
  { key: 'notes', label: 'Notes', type: 'textarea', span: 'span-4', rows: 4 },
];

@Component({
  selector: 'app-realtime-media',
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
  templateUrl: './media.html',
  styleUrls: ['./media.scss'],
})
export class RealtimeMediaPage {
  private readonly api = inject(RealtimeMediaService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);
  private readonly routeData = toSignal(this.route.data, { initialValue: this.route.snapshot.data });

  readonly resource = computed<MediaResource>(() => {
    const value = this.routeData()?.['resource'];
    return value === 'domains' ? 'domains' : 'servers';
  });
  readonly isServers = computed(() => this.resource() === 'servers');
  readonly isDomains = computed(() => this.resource() === 'domains');
  readonly searchInput = signal('');
  readonly statusInput = signal('');
  private readonly appliedSearch = signal('');
  private readonly appliedStatus = signal('');
  readonly saving = signal(false);
  readonly mutating = signal(false);
  readonly editing = signal<MediaRecord | null>(null);
  readonly selected = signal<Set<string>>(new Set());
  readonly generatedInstall = signal<MediaRecord | null>(null);
  readonly generatedInstallSource = signal<MediaRecord | null>(null);
  readonly domainLookupEnabled = signal(false);
  readonly formModel = signal<MediaFormModel>(this.defaultFormModel());
  readonly form = createForm(this.formModel);
  readonly pageTitle = computed(() =>
    this.isDomains() ? 'Media/RTP Domains' : 'Media Servers',
  );
  readonly pageSubtitle = computed(() =>
    this.isDomains()
      ? 'Assign realtime media domains to RTP/media relay operations.'
      : 'Register dedicated RTP/media relay servers for realtime sessions.',
  );
  readonly statusFilterOptions = signal([
    { value: '', label: 'All' },
    { value: '1', label: 'Active' },
    { value: '0', label: 'Inactive' },
  ]);

  readonly dataSource = new MatTableDataSource<MediaRecord>([]);
  readonly displayedColumns = computed(() =>
    this.isDomains()
      ? ['select', 'domain', 'purpose', 'status', 'updated', 'actions']
      : ['select', 'name', 'engine', 'domain', 'control', 'ports', 'status', 'lastSeen', 'actions'],
  );
  readonly recordFields = computed(() => (this.isDomains() ? DOMAIN_RECORD_FIELDS : RECORD_FIELDS));
  readonly networkFields = signal(NETWORK_FIELDS);
  readonly notesFields = computed(() => (this.isDomains() ? DOMAIN_NOTES_FIELDS : NOTES_FIELDS));

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly mediaFormDialog = viewChild<TemplateRef<unknown>>('mediaFormDialog');
  readonly installCommandDialog = viewChild<TemplateRef<unknown>>('installCommandDialog');

  private dialogRef: MatDialogRef<unknown> | null = null;
  private binding: CrudDialogBinding | null = null;
  private installCommandBinding: CrudDialogBinding | null = null;

  private readonly itemsResource = resource({
    params: () => ({
      resource: this.resource(),
      search: this.appliedSearch(),
      status: this.appliedStatus(),
    }),
    defaultValue: [] as MediaRecord[],
    loader: async ({ params }) => {
      const status = params.status === '' ? null : Number(params.status);
      const response = await this.api.list(params.resource, {
        limit: 5000,
        search: params.search,
        status,
      });
      return response?.data?.items ?? [];
    },
  });

  private readonly domainsResource = resource({
    params: () => ({ enabled: this.domainLookupEnabled() }),
    defaultValue: [] as MediaRecord[],
    loader: async ({ params }) => {
      if (!params.enabled) return [];
      const response = await this.api.listRealtimeDomains({ purpose: 'media', status: 1, limit: 5000 });
      return response?.data?.items ?? [];
    },
  });

  private readonly mediaDomainsResource = resource({
    params: () => ({ enabled: this.domainLookupEnabled() && this.isServers() }),
    defaultValue: [] as MediaRecord[],
    loader: async ({ params }) => {
      if (!params.enabled) return [];
      const response = await this.api.list('domains', { status: 1, limit: 5000 });
      return response?.data?.items ?? [];
    },
  });

  readonly domainSelectOptions = computed<MnsSearchSelectFieldOption[]>(() =>
    this.domainsResource
      .value()
      .map((domain: MediaRecord) => {
        const value = domain['RtdUUID'];
        const label = domain['RtdName'] || domain['DomainName'] || value;
        return {
          value: String(value ?? ''),
          label: String(label ?? ''),
          searchText: `${label ?? ''} ${domain['RtdPurpose'] ?? ''} ${value ?? ''}`,
        };
      })
      .filter((option: MnsSearchSelectFieldOption) => option.value),
  );

  readonly mediaDomainSelectOptions = computed<MnsSearchSelectFieldOption[]>(() =>
    this.mediaDomainsResource
      .value()
      .map((domain: MediaRecord) => {
        const value = domain['RmdUUID'];
        const label = domain['RtdName'] || domain['DomainName'] || value;
        return {
          value: String(value ?? ''),
          label: String(label ?? ''),
          searchText: `${label ?? ''} ${domain['RtdPurpose'] ?? ''} ${domain['RmdID'] ?? ''} ${
            value ?? ''
          }`,
        };
      })
      .filter((option: MnsSearchSelectFieldOption) => option.value),
  );

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
    this.snack.error(this.errorMessage(error, `Failed to load ${this.resourceLabelPlural()}.`));
  });

  private readonly cleanup = this.destroyRef.onDestroy(() => {
    this.closeDialog();
    this.closeInstallCommandDialog();
  });

  refreshList(): void {
    this.itemsResource.reload();
  }

  applySearchFilters(): void {
    const nextSearch = this.searchInput().trim();
    const nextStatus = this.statusInput();
    this.dataSource.filter = nextSearch.toLowerCase();
    this.paginator()?.firstPage();
    if (nextSearch === this.appliedSearch() && nextStatus === this.appliedStatus()) {
      this.itemsResource.reload();
    } else {
      this.appliedSearch.set(nextSearch);
      this.appliedStatus.set(nextStatus);
    }
  }

  clearSearchFilters(): void {
    this.searchInput.set('');
    this.statusInput.set('');
    this.dataSource.filter = '';
    this.paginator()?.firstPage();
    if (this.appliedSearch() || this.appliedStatus()) {
      this.appliedSearch.set('');
      this.appliedStatus.set('');
    } else {
      this.itemsResource.reload();
    }
  }

  startCreate(): void {
    this.editing.set(null);
    this.formModel.set(this.defaultFormModel());
    this.openDialog();
  }

  startEdit(row: MediaRecord): void {
    this.editing.set(row);
    this.formModel.set(this.formModelFromRow(row));
    this.openDialog();
  }

  openDialog(): void {
    const template = this.mediaFormDialog();
    if (!template) return;
    this.binding = openCrudTemplateDialog(this.dialog, template, 'realtime-media-form-dialog', {
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
      const resource = this.resource();
      if (row) {
        await this.api.update(resource, this.uuid(row), this.payload());
        this.snack.success(`${this.resourceLabel()} updated.`);
      } else {
        const response = await this.api.create(resource, this.payload());
        this.snack.success(`${this.resourceLabel()} created.`);
        if (!saveAndNew) {
          const item = response?.data?.item ?? null;
          this.closeDialog();
          if (resource === 'servers' && item?.RmsUUID) {
            await this.generateInstallCommandForUUID(String(item.RmsUUID), item, false);
          }
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
      this.snack.error(this.errorMessage(error, `Failed to save ${this.resourceLabel()}.`));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(row: MediaRecord): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: `Delete ${this.resourceLabel()}`,
            message: `Delete ${this.name(row)}?`,
            confirmLabel: 'Delete',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.runMutation(async () => {
      await this.api.remove(this.resource(), this.uuid(row));
      this.snack.success(`${this.resourceLabel()} deleted.`);
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
            title: `Delete selected ${this.resourceLabelPlural()}`,
            message: `Delete ${ids.length} selected record(s)?`,
            confirmLabel: 'Delete selected',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.runMutation(async () => {
      const result = await this.api.removeMany(this.resource(), ids);
      const failed = result?.data?.failed ?? [];
      this.selected.set(
        new Set<string>(failed.map((item: any) => String(item.uuid ?? '')).filter(Boolean)),
      );
      failed.length
        ? this.snack.error(`${failed.length} selected record(s) could not be deleted.`)
        : this.snack.success(`Selected ${this.resourceLabelPlural()} deleted.`);
      this.itemsResource.reload();
    });
  }

  async generateInstallCommand(row: MediaRecord): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: 'Generate Install Command',
            message: `Generate a new install command for ${this.name(row)}? The previous media runtime token will be replaced.`,
            confirmLabel: 'Generate command',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.generateInstallCommandForUUID(this.uuid(row), row);
  }

  private async generateInstallCommandForUUID(
    uuid: string,
    source: MediaRecord | null,
    showSuccess = true,
  ): Promise<void> {
    try {
      const response = await this.api.generateInstallCommand(uuid);
      this.generatedInstall.set(response?.data ?? null);
      this.generatedInstallSource.set(source);
      this.openInstallCommandDialog();
      if (showSuccess) this.snack.success('Media server install command generated.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to generate media server install command.'));
    }
  }

  openInstallCommandDialog(): void {
    const template = this.installCommandDialog();
    if (!template || this.installCommandBinding) return;
    const binding = openCrudTemplateDialog(this.dialog, template, 'install-command-dialog-panel');
    this.installCommandBinding = binding;
    bindDialogClosed(binding.ref, () => {
      binding.stop();
      if (this.installCommandBinding === binding) this.installCommandBinding = null;
    });
  }

  closeInstallCommandDialog(): void {
    const binding = this.installCommandBinding;
    this.installCommandBinding = null;
    binding?.stop();
    binding?.ref.close();
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
      '--control-ip',
      this.shellQuote(String(source?.['RmsControlIP'] || token['controlIP'] || '127.0.0.1')),
      '--control-port',
      this.shellQuote(String(source?.['RmsControlPort'] || token['controlPort'] || '2223')),
      '--media-port-min',
      this.shellQuote(String(source?.['RmsMinMediaPort'] || token['minMediaPort'] || '30000')),
      '--media-port-max',
      this.shellQuote(String(source?.['RmsMaxMediaPort'] || token['maxMediaPort'] || '40000')),
    ];
    const publicIP = String(token['publicIP'] || source?.['RmsPublicIP'] || '').trim();
    const privateIP = String(token['privateIP'] || source?.['RmsPrivateIP'] || '').trim();
    if (publicIP) args.push('--public-ip', this.shellQuote(publicIP));
    if (privateIP) args.push('--private-ip', this.shellQuote(privateIP));

    return [
      'sudo install -d -m 0755 /opt/mnscloud',
      'cd /opt/mnscloud',
      '[ -d mnscloud-media/.git ] && sudo git -C mnscloud-media pull || gh repo clone manaoscloud/mnscloud-media',
      `sudo bash /opt/mnscloud/mnscloud-media/scripts/install-media.sh ${args.join(' ')}`,
      'sudo bash /opt/mnscloud/mnscloud-media/scripts/validate-media.sh',
    ].join(' && ');
  }

  notifyCommandCopied(copied: boolean): void {
    copied
      ? this.snack.success('Install command copied.')
      : this.snack.error('Failed to copy install command.');
  }

  installCommandDetails(): Array<{ label: string; value: unknown; monospace?: boolean }> {
    const token = this.generatedInstall();
    return [
      { label: 'API base', value: window.location.origin, monospace: true },
      { label: 'Node UUID', value: token?.['nodeUUID'], monospace: true },
      { label: 'Control socket', value: `${token?.['controlIP'] ?? '127.0.0.1'}:${token?.['controlPort'] ?? 2223}`, monospace: true },
      { label: 'Runtime', value: 'mnscloud-media', monospace: true },
    ];
  }

  formField(key: keyof MediaFormModel | string): SignalFormField {
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

  uuid(row: MediaRecord): string {
    return String(this.isDomains() ? row['RmdUUID'] ?? '' : row['RmsUUID'] ?? '');
  }

  name(row: MediaRecord): string {
    return String(
      this.isDomains()
        ? row['RtdName'] ?? row['DomainName'] ?? row['RmdID'] ?? ''
        : row['RmsName'] ?? '',
    );
  }

  status(row: MediaRecord): boolean {
    return Number(this.isDomains() ? row['RmdStatus'] ?? 0 : row['RmsStatus'] ?? 0) === 1;
  }

  cell(row: MediaRecord, column: string): string {
    const map: Record<string, any> = {
      name: row['RmsName'],
      engine: row['RmsEngine'],
      domain: row['RtdName'] ?? row['DomainName'],
      purpose: this.purposeLabel(row['RtdPurpose']),
      control: `${row['RmsControlIP'] || '127.0.0.1'}:${row['RmsControlPort'] ?? 2223}`,
      ports: `${row['RmsMinMediaPort'] ?? 30000}-${row['RmsMaxMediaPort'] ?? 40000}`,
      status: this.status(row) ? 'ACTIVE' : 'INACTIVE',
      lastSeen: row['RmsLastSeenAt'] || '-',
      updated: row['RmdDateUpdated'] || '-',
    };
    return String(map[column] ?? '');
  }

  columnLabel(column: string): string {
    const labels: Record<string, string> = {
      name: 'Name',
      engine: 'Engine',
      domain: 'Domain',
      purpose: 'Purpose',
      control: 'Control',
      ports: 'RTP Ports',
      status: 'Status',
      lastSeen: 'Last Seen',
      updated: 'Updated',
      actions: 'Actions',
    };
    return labels[column] ?? column;
  }

  isSelected(row: MediaRecord): boolean {
    return this.selected().has(this.uuid(row));
  }

  toggle(row: MediaRecord, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      checked ? next.add(this.uuid(row)) : next.delete(this.uuid(row));
      return next;
    });
  }

  visibleRows(): MediaRecord[] {
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

  private defaultFormModel(): MediaFormModel {
    return {
      status: 1,
      name: '',
      engine: 'rtpengine',
      mediaDomainUUID: '',
      realtimeDomainUUID: '',
      nodeUUID: '',
      hostname: '',
      publicIP: '',
      privateIP: '',
      controlIP: '127.0.0.1',
      controlPort: 2223,
      minMediaPort: 30000,
      maxMediaPort: 40000,
      version: '',
      configJson: '{}',
      notes: '',
    };
  }

  private formModelFromRow(row: MediaRecord): MediaFormModel {
    const base = this.defaultFormModel();
    return {
      ...base,
      status: Number(this.isDomains() ? row['RmdStatus'] ?? 1 : row['RmsStatus'] ?? 1),
      name: row['RmsName'] ?? '',
      engine: row['RmsEngine'] ?? 'rtpengine',
      mediaDomainUUID: row['RealtimeMediaDomainRmdUUID'] ?? '',
      realtimeDomainUUID: row['RealtimeDomainRtdUUID'] ?? '',
      nodeUUID: row['RmsNodeUUID'] ?? '',
      hostname: row['RmsHostname'] ?? '',
      publicIP: row['RmsPublicIP'] ?? '',
      privateIP: row['RmsPrivateIP'] ?? '',
      controlIP: row['RmsControlIP'] ?? '127.0.0.1',
      controlPort: row['RmsControlPort'] ?? 2223,
      minMediaPort: row['RmsMinMediaPort'] ?? 30000,
      maxMediaPort: row['RmsMaxMediaPort'] ?? 40000,
      version: row['RmsVersion'] ?? '',
      configJson: JSON.stringify(row['RmsConfig'] ?? {}, null, 2),
      notes: row['RmsNotes'] ?? '',
    };
  }

  private payload(): MediaRecord {
    const raw = this.formModel();
    if (this.isDomains()) {
      return {
        realtimeDomainUUID: raw.realtimeDomainUUID,
        notes: String(raw.notes ?? '').trim() || null,
        status: Number(raw.status ?? 1),
      };
    }
    const payload: MediaRecord = {
      ...raw,
      status: Number(raw.status ?? 1),
      controlPort: this.numberOrNull(raw.controlPort),
      minMediaPort: this.numberOrNull(raw.minMediaPort),
      maxMediaPort: this.numberOrNull(raw.maxMediaPort),
    };
    if (raw.configJson) {
      try {
        payload['config'] = JSON.parse(raw.configJson);
      } catch {
        payload['config'] = raw.configJson;
      }
    }
    delete payload['configJson'];
    return payload;
  }

  resourceLabel(): string {
    return this.isDomains() ? 'Media domain' : 'Media server';
  }

  resourceLabelPlural(): string {
    return this.isDomains() ? 'media domains' : 'media servers';
  }

  private purposeLabel(value: unknown): string {
    const purpose = String(value ?? '').toLowerCase();
    if (purpose === 'media') return 'Media/RTP';
    if (purpose === 'turn') return 'TURN/STUN';
    if (purpose === 'webrtc') return 'WebRTC';
    if (purpose === 'sfu') return 'SFU';
    if (purpose === 'signaling') return 'Signaling';
    if (purpose === 'chat') return 'Chat';
    if (purpose === 'mixed') return 'Mixed';
    return purpose || '-';
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
