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
import { Subscription, firstValueFrom } from 'rxjs';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SnackbarService } from '../../../services/snackbar.service';
import { SbcRecord, SbcResource, VoipSbcService } from './sbc.service';
import { TranslocoPipe } from '@jsverse/transloco';

type LookupKey = 'providers' | 'servers' | 'trunks';
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
  resource: SbcResource;
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
  publicIP: 'Public IP',
  lastSeen: 'Last Seen',
  provider: 'Provider',
  server: 'Server',
  host: 'Host',
  transport: 'Transport',
  trunk: 'Trunk',
  prefix: 'Prefix',
  priority: 'Priority',
  type: 'Type',
  status: 'Status',
};

const CONFIGS: Record<SbcResource, Config> = {
  providers: {
    resource: 'providers',
    title: 'SBC Providers',
    subtitle: 'Register SBC platforms and providers.',
    uuid: 'VbpUUID',
    name: 'VbpName',
    status: 'VbpStatus',
    columns: ['name', 'engine', 'status'],
    fields: [
      { key: 'name', label: 'Name', required: true },
      {
        key: 'engine',
        label: 'Engine',
        type: 'select',
        options: ['opensips', 'kamailio', 'sippulse', 'vsc', 'custom'],
        required: true,
      },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
      { key: 'configJson', label: 'Config JSON', type: 'textarea', span: 'span-4' },
    ],
  },
  servers: {
    resource: 'servers',
    title: 'SBC Servers',
    subtitle: 'Register SBC platform nodes authorized by node UUID.',
    uuid: 'VbsUUID',
    name: 'VbsName',
    status: 'VbsStatus',
    columns: ['name', 'engine', 'hostname', 'publicIP', 'status', 'lastSeen'],
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'nodeUUID', label: 'Node UUID' },
      {
        key: 'engine',
        label: 'Engine',
        type: 'select',
        options: ['opensips', 'kamailio', 'sippulse', 'vsc', 'custom'],
      },
      { key: 'hostname', label: 'Hostname' },
      { key: 'publicIP', label: 'Public IP' },
      { key: 'privateIP', label: 'Private IP' },
      { key: 'baseUrl', label: 'Base URL' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
      { key: 'notes', label: 'Notes', type: 'textarea', span: 'span-4' },
    ],
  },
  trunks: {
    resource: 'trunks',
    title: 'SBC Trunks',
    subtitle: 'Register carrier trunks used by SBC routing.',
    uuid: 'VstUUID',
    name: 'VstName',
    status: 'VstStatus',
    columns: ['name', 'provider', 'server', 'host', 'transport', 'status'],
    fields: [
      {
        key: 'providerUUID',
        label: 'Provider',
        type: 'lookup',
        lookup: 'providers',
        required: true,
      },
      { key: 'serverUUID', label: 'Server', type: 'lookup', lookup: 'servers' },
      { key: 'name', label: 'Name', required: true },
      {
        key: 'direction',
        label: 'Direction',
        type: 'select',
        options: ['inbound', 'outbound', 'both'],
      },
      { key: 'host', label: 'Host', required: true },
      { key: 'port', label: 'Port', type: 'number' },
      { key: 'transport', label: 'Transport', type: 'select', options: ['udp', 'tcp', 'tls'] },
      { key: 'authUsername', label: 'Auth Username' },
      { key: 'authPassword', label: 'Auth Password' },
      { key: 'fromDomain', label: 'From Domain' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
      { key: 'configJson', label: 'Config JSON', type: 'textarea', span: 'span-4' },
    ],
  },
  routes: {
    resource: 'routes',
    title: 'SBC Routes',
    subtitle: 'Route prefixes to carrier trunks.',
    uuid: 'VbrUUID',
    name: 'VbrName',
    status: 'VbrStatus',
    columns: ['name', 'trunk', 'prefix', 'priority', 'status'],
    fields: [
      { key: 'trunkUUID', label: 'Trunk', type: 'lookup', lookup: 'trunks', required: true },
      { key: 'name', label: 'Name', required: true },
      { key: 'prefix', label: 'Prefix' },
      { key: 'priority', label: 'Priority', type: 'number' },
      { key: 'stripDigits', label: 'Strip Digits', type: 'number' },
      { key: 'prepend', label: 'Prepend' },
      { key: 'destinationPattern', label: 'Destination Pattern' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
    ],
  },
  policies: {
    resource: 'policies',
    title: 'SBC Policies',
    subtitle: 'Manage ACL, rate, codec, NAT, header and routing policies.',
    uuid: 'VpoUUID',
    name: 'VpoName',
    status: 'VpoStatus',
    columns: ['name', 'server', 'type', 'priority', 'status'],
    fields: [
      { key: 'serverUUID', label: 'Server', type: 'lookup', lookup: 'servers' },
      { key: 'name', label: 'Name', required: true },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: ['acl', 'rate_limit', 'codec', 'nat', 'header', 'routing'],
      },
      { key: 'priority', label: 'Priority', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
      { key: 'configJson', label: 'Config JSON', type: 'textarea', span: 'span-4' },
    ],
  },
};

@Component({
  selector: 'app-voip-sbc',
  standalone: true,
  imports: [
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
  templateUrl: './sbc.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./sbc.scss'],
})
export class VoipSbcPage implements AfterViewInit, OnDestroy, OnInit {
  private readonly api = inject(VoipSbcService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  readonly currentResource = signal<SbcResource>('providers');
  readonly currentScopeMaster = signal(false);
  readonly isMaster = computed(() => this.currentScopeMaster());
  readonly config = computed(() => CONFIGS[this.currentResource()]);
  readonly title = computed(() => this.config().title);
  readonly subtitle = computed(() => this.config().subtitle);
  readonly saving = signal(false);
  readonly editing = signal<SbcRecord | null>(null);
  readonly selected = new Set<string>();
  private readonly appliedSearch = signal('');
  searchInput = '';
  search = '';
  readonly dataSource = new MatTableDataSource<SbcRecord>([]);
  readonly displayedColumns = computed(() => ['select', ...this.config().columns, 'actions']);
  readonly lookups: Record<LookupKey, LookupOption[]> = { providers: [], servers: [], trunks: [] };
  readonly lookupSearch: Record<LookupKey, string> = { providers: '', servers: '', trunks: '' };
  form = this.fb.group({});
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  private dialogRef: MatDialogRef<unknown> | null = null;
  private binding: CrudDialogBinding | null = null;
  private routeSub: Subscription | null = null;
  private viewReady = false;

  private readonly recordsResource = resource({
    params: () => ({
      resource: this.config().resource,
      isMaster: this.isMaster(),
      search: this.appliedSearch(),
    }),
    defaultValue: [] as SbcRecord[],
    loader: async ({ params }) => {
      const res = await this.api.list(params.resource, params.isMaster, {
        limit: 5000,
        search: params.search,
      });
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
    this.snack.error(this.errorMessage(error, 'Failed to load SBC records.'));
  });

  ngOnInit() {
    this.routeSub = this.route.data.subscribe((data) => {
      this.currentResource.set((data['resource'] ?? 'providers') as SbcResource);
      this.currentScopeMaster.set(data['scope'] === 'master');
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
    this.routeSub?.unsubscribe();
    this.binding?.stop();
  }
  uuid(row: SbcRecord) {
    return String(row[this.config().uuid] ?? '');
  }
  name(row: SbcRecord) {
    return String(row[this.config().name] ?? '');
  }
  status(row: SbcRecord) {
    return Number(row[this.config().status] ?? 0) === 1;
  }
  columnLabel(column: string) {
    return COLUMN_LABELS[column] ?? column;
  }
  cell(row: SbcRecord, column: string) {
    const map: Record<string, any> = {
      name: this.name(row),
      engine: row['VbpEngine'] ?? row['VbsEngine'],
      hostname: row['VbsHostname'],
      publicIP: row['VbsPublicIP'],
      lastSeen: row['VbsLastSeenAt'],
      provider: row['ProviderName'],
      server: row['ServerName'],
      host: row['VstHost'],
      transport: row['VstTransport'],
      trunk: row['TrunkName'],
      prefix: row['VbrPrefix'],
      priority: row['VbrPriority'] ?? row['VpoPriority'],
      type: row['VpoType'],
      status: this.status(row) ? 'ACTIVE' : 'INACTIVE',
    };
    return map[column] ?? '';
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
        const res = await this.api.list(key, this.isMaster(), { limit: 5000 });
        const rows = res?.data?.items ?? [];
        this.lookups[key] = rows
          .map((row: SbcRecord) => ({
            value: String(
              row[key === 'providers' ? 'VbpUUID' : key === 'servers' ? 'VbsUUID' : 'VstUUID'] ??
                '',
            ),
            label: String(
              row[key === 'providers' ? 'VbpName' : key === 'servers' ? 'VbsName' : 'VstName'] ??
                '',
            ),
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
  buildForm(row?: SbcRecord | null) {
    const group: Record<string, any> = {};
    for (const f of this.config().fields)
      group[f.key] = [this.valueForField(f.key, row), f.required ? [Validators.required] : []];
    this.form = this.fb.group(group);
  }
  valueForField(key: string, row?: SbcRecord | null) {
    if (!row) return key === 'status' ? 'active' : '';
    const m: Record<string, string> = {
      name: this.config().name,
      engine: 'VbpEngine',
      nodeUUID: 'VbsNodeUUID',
      hostname: 'VbsHostname',
      publicIP: 'VbsPublicIP',
      privateIP: 'VbsPrivateIP',
      baseUrl: 'VbsBaseUrl',
      notes: 'VbsNotes',
      providerUUID: 'VoipSbcProviderVbpUUID',
      serverUUID: 'VoipSbcServerVbsUUID',
      direction: 'VstDirection',
      host: 'VstHost',
      port: 'VstPort',
      transport: 'VstTransport',
      authUsername: 'VstAuthUsername',
      fromDomain: 'VstFromDomain',
      trunkUUID: 'VoipSbcTrunkVstUUID',
      prefix: 'VbrPrefix',
      priority: 'VbrPriority',
      stripDigits: 'VbrStripDigits',
      prepend: 'VbrPrepend',
      destinationPattern: 'VbrDestinationPattern',
      type: 'VpoType',
    };
    if (key === 'status') return this.status(row) ? 'active' : 'inactive';
    if (key === 'configJson')
      return JSON.stringify(
        row['VbpConfig'] ?? row['VstConfig'] ?? row['VpoConfig'] ?? {},
        null,
        2,
      );
    return row[m[key]] ?? '';
  }
  async startCreate() {
    this.editing.set(null);
    await this.loadLookups();
    this.buildForm(null);
    this.openDialog();
  }
  async startEdit(row: SbcRecord) {
    this.editing.set(row);
    await this.loadLookups();
    this.buildForm(row);
    this.openDialog();
  }
  openDialog() {
    const formDialog = this.formDialog();
    if (!formDialog) return;
    this.binding = openCrudTemplateDialog(this.dialog, formDialog, 'voip-sbc-form-dialog', {
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
    if (raw['configJson']) {
      try {
        p['config'] = JSON.parse(raw['configJson']);
      } catch {
        p['config'] = raw['configJson'];
      }
    }
    delete p['configJson'];
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
      if (row)
        await this.api.update(
          this.config().resource,
          this.uuid(row),
          this.payload(),
          this.isMaster(),
        );
      else await this.api.create(this.config().resource, this.payload(), this.isMaster());
      this.snack.success('SBC record saved.');
      this.recordsResource.reload();
      if (saveAndNew && !row) {
        this.editing.set(null);
        this.buildForm(null);
      } else this.closeDialog();
    } catch (e: any) {
      this.snack.error(e?.error?.error || e?.message || 'Failed to save SBC record.');
    } finally {
      this.saving.set(false);
    }
  }
  async remove(row: SbcRecord) {
    const ok = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: 'Delete SBC Record',
            message: `Delete ${this.name(row)}?`,
            confirmText: 'Delete',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    await this.api.remove(this.config().resource, this.uuid(row), this.isMaster());
    this.snack.success('SBC record deleted.');
    this.recordsResource.reload();
  }
  isSelected(row: SbcRecord) {
    return this.selected.has(this.uuid(row));
  }
  toggle(row: SbcRecord, checked: boolean) {
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
            title: 'Delete Selected SBC Records',
            message: `Delete ${ids.length} selected record(s)?`,
            confirmText: 'Delete selected',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    const result = await this.api.removeMany(this.config().resource, ids, this.isMaster());
    const failed = result?.data?.failed ?? [];
    const uuidKey = this.config().uuid;
    const failedIds = new Set(
      failed.map((item: Record<string, string>) => item[uuidKey]).filter(Boolean),
    );
    this.selected.clear();
    for (const id of failedIds) this.selected.add(String(id));
    if (failed.length)
      this.snack.error(`${failed.length} selected SBC record(s) could not be deleted.`);
    else this.snack.success('Selected SBC records deleted.');
    this.recordsResource.reload();
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string }; message?: string };
    return maybe?.error?.error || maybe?.message || fallback;
  }
}
