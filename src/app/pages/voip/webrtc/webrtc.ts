import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
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
import { VoipWebRtcService, WebRtcRecord, WebRtcResource } from './webrtc.service';

type LookupKey = 'servers';
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
};

@Component({
  selector: 'app-voip-webrtc',
  standalone: true,
  imports: [
    CommonModule,
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
    MatTooltipModule,
  ],
  templateUrl: './webrtc.html',
  styleUrls: ['./webrtc.scss'],
})
export class VoipWebRtcPage implements AfterViewInit, OnDestroy, OnInit {
  private readonly api = inject(VoipWebRtcService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  readonly currentResource = signal<WebRtcResource>('servers');
  readonly config = computed(() => CONFIGS[this.currentResource()]);
  readonly title = computed(() => this.config().title);
  readonly subtitle = computed(() => this.config().subtitle);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<WebRtcRecord | null>(null);
  readonly selected = new Set<string>();
  searchInput = '';
  search = '';
  readonly dataSource = new MatTableDataSource<WebRtcRecord>([]);
  readonly displayedColumns = computed(() => ['select', ...this.config().columns, 'actions']);
  readonly lookups: Record<LookupKey, LookupOption[]> = { servers: [] };
  readonly lookupSearch: Record<LookupKey, string> = { servers: '' };
  form = this.fb.group({});
  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('formDialog') formDialog?: TemplateRef<unknown>;
  @ViewChild('tokenDialog') tokenDialog?: TemplateRef<unknown>;
  private dialogRef: MatDialogRef<unknown> | null = null;
  readonly generatedToken = signal('');
  private binding: CrudDialogBinding | null = null;
  private routeSub: Subscription | null = null;
  private viewReady = false;

  ngOnInit() {
    this.routeSub = this.route.data.subscribe((data) => {
      this.currentResource.set((data['resource'] ?? 'servers') as WebRtcResource);
      this.searchInput = '';
      this.search = '';
      this.dataSource.filter = '';
      this.selected.clear();
      if (this.viewReady) void this.load();
    });
  }
  ngAfterViewInit() {
    this.viewReady = true;
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.filterPredicate = (row, filter) =>
      JSON.stringify(row).toLowerCase().includes(filter);
    this.dataSource.sortingDataAccessor = (row, column) =>
      String(this.cell(row, column) ?? '').toLowerCase();
    setTimeout(() => this.load(), 0);
  }
  ngOnDestroy() {
    this.routeSub?.unsubscribe();
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
      key: row['VwpKey'],
      value: this.displayValue(row['VwpValue']),
      type: row['VwpType'],
      description: row['VwpDescription'],
      status: this.status(row) ? 'ACTIVE' : 'INACTIVE',
    };
    return map[column] ?? '';
  }
  displayValue(value: unknown) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
  async load() {
    this.loading.set(true);
    try {
      const res = await this.api.list(this.config().resource, {
        limit: 5000,
        search: this.search,
      });
      this.dataSource.data = res?.data?.items ?? [];
      this.reconcile();
    } catch (e: any) {
      this.snack.error(e?.error?.error || e?.message || 'Failed to load WebRTC records.');
    } finally {
      setTimeout(() => this.loading.set(false), 600);
    }
  }
  refreshList() {
    void this.load();
  }
  applySearchFilters() {
    this.search = this.searchInput.trim();
    this.dataSource.filter = this.search.toLowerCase();
    this.paginator?.firstPage();
    void this.load();
  }
  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.dataSource.filter = '';
    this.paginator?.firstPage();
    void this.load();
  }
  async loadLookups() {
    const needs = new Set(
      this.config()
        .fields.map((field) => field.lookup)
        .filter(Boolean) as LookupKey[],
    );
    await Promise.all(
      [...needs].map(async (key) => {
        const res = await this.api.list(key, { limit: 5000 });
        const rows = res?.data?.items ?? [];
        this.lookups[key] = rows
          .map((row: WebRtcRecord) => ({
            value: String(row['VwrUUID'] ?? ''),
            label: String(row['VwrName'] ?? ''),
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
      notes: 'VwrNotes',
      serverUUID: 'VoipWebRtcServerVwrUUID',
      key: 'VwpKey',
      type: 'VwpType',
      description: 'VwpDescription',
    };
    if (key === 'status') return this.status(row) ? 'active' : 'inactive';
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
    if (!this.formDialog) return;
    this.binding = openCrudTemplateDialog(this.dialog, this.formDialog, 'voip-webrtc-form-dialog', {
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
      if (row) await this.api.update(this.config().resource, this.uuid(row), this.payload());
      else {
        const result = await this.api.create(this.config().resource, this.payload());
        const installToken = result?.data?.installToken;
        if (installToken) {
          this.generatedToken.set(installToken);
          this.openTokenDialog();
          this.snack.success('WebRTC install command generated.');
        }
      }
      if (row || this.config().resource !== 'servers') this.snack.success('WebRTC record saved.');
      await this.load();
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
    await this.api.remove(this.config().resource, this.uuid(row));
    this.snack.success('WebRTC record deleted.');
    await this.load();
  }
  async rotateToken(row: WebRtcRecord) {
    const ok = await firstValueFrom(
      this.dialog
        .open(SlowConfirmDialogComponent, {
          panelClass: 'slow-confirm-dialog',
          disableClose: true,
          data: {
            title: 'Replace WebRTC Node Token',
            message: `Generate a replacement one-time token for ${this.name(row)}?`,
            confirmText: 'Generate token',
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    const result = await this.api.rotateToken(this.uuid(row));
    const token = result?.data?.token;
    if (token) {
      this.generatedToken.set(token);
      this.openTokenDialog();
    }
    this.snack.success(token ? 'WebRTC install command generated.' : 'WebRTC token replaced.');
    await this.load();
  }
  openTokenDialog() {
    if (!this.tokenDialog) return;
    this.dialog.open(this.tokenDialog, {
      width: 'min(760px, calc(100vw - 32px))',
      maxWidth: '760px',
      disableClose: false,
    });
  }
  tokenCommand() {
    const token = this.generatedToken();
    return `sudo bash -lc 'set -euo pipefail
install -d -m 700 /etc/mnscloud/kamailio-webrtc
printf "%s\\n" "${token}" > /etc/mnscloud/kamailio-webrtc/node.token
chmod 600 /etc/mnscloud/kamailio-webrtc/node.token
test -s /etc/mnscloud/kamailio-webrtc/api.base || { echo "Missing /etc/mnscloud/kamailio-webrtc/api.base. Run the WebRTC installer first." >&2; exit 1; }
test -s /etc/mnscloud/kamailio-webrtc/node.uuid || { echo "Missing /etc/mnscloud/kamailio-webrtc/node.uuid. Run the WebRTC installer first." >&2; exit 1; }
API=$(tr -d "\\r\\n" < /etc/mnscloud/kamailio-webrtc/api.base)
UUID=$(tr -d "\\r\\n" < /etc/mnscloud/kamailio-webrtc/node.uuid)
TOKEN=$(tr -d "\\r\\n" < /etc/mnscloud/kamailio-webrtc/node.token)
curl -fsS -X POST \\
  -H "Authorization: Bearer \${TOKEN}" \\
  -H "X-WebRTC-Node-UUID: \${UUID}" \\
  -H "X-WebRTC-Engine: kamailio" \\
  -H "Content-Type: application/json" \\
  --data "{\\"node_uuid\\":\\"\${UUID}\\",\\"engine\\":\\"kamailio\\"}" \\
  "\${API%/}/api/v1/webrtc/edge/validate" >/dev/null
PUBLIC_DOMAIN=""
if [ -s /etc/mnscloud/kamailio-webrtc/public.domain ]; then
  PUBLIC_DOMAIN=$(tr -d "\\r\\n" < /etc/mnscloud/kamailio-webrtc/public.domain)
fi
if [ -z "\${PUBLIC_DOMAIN}" ]; then
  PUBLIC_DOMAIN=$(curl -fsS \\
    -H "Authorization: Bearer \${TOKEN}" \\
    -H "X-WebRTC-Node-UUID: \${UUID}" \\
    "\${API%/}/api/v1/webrtc/edge/config" | jq -r ".data.server.publicDomain // empty")
fi
HOSTNAME=$(hostname -f 2>/dev/null || hostname)
PRIVATE_IP=$(ip -o -4 route get 1.1.1.1 2>/dev/null | awk "{for(i=1;i<=NF;i++) if(\\$i==\\"src\\") {print \\$(i+1); exit}}" || true)
PUBLIC_IP=""
if [ -n "\${PUBLIC_DOMAIN}" ]; then
  PUBLIC_IP=$(getent ahostsv4 "\${PUBLIC_DOMAIN}" | awk "{print \\$1; exit}" || true)
fi
BASE_URL=""
if [ -n "\${PUBLIC_DOMAIN}" ]; then
  BASE_URL="https://\${PUBLIC_DOMAIN}"
fi
VERSION=$(dpkg-query -W -f="\${Version}" kamailio 2>/dev/null | sed "s/^/kamailio:/" || true)
curl -fsS -X POST \\
  -H "Authorization: Bearer \${TOKEN}" \\
  -H "X-WebRTC-Node-UUID: \${UUID}" \\
  -H "X-WebRTC-Engine: kamailio" \\
  -H "Content-Type: application/json" \\
  --data "$(jq -n \\
    --arg node_uuid "\${UUID}" \\
    --arg engine "kamailio" \\
    --arg hostname "\${HOSTNAME}" \\
    --arg publicDomain "\${PUBLIC_DOMAIN}" \\
    --arg publicIP "\${PUBLIC_IP}" \\
    --arg privateIP "\${PRIVATE_IP}" \\
    --arg baseUrl "\${BASE_URL}" \\
    --arg version "\${VERSION}" \\
    "{node_uuid:\\$node_uuid,engine:\\$engine,hostname:\\$hostname,publicDomain:\\$publicDomain,publicIP:\\$publicIP,privateIP:\\$privateIP,baseUrl:\\$baseUrl,version:\\$version}")" \\
  "\${API%/}/api/v1/webrtc/edge/bootstrap" >/dev/null
systemctl restart mnscloud-webrtc-sync.service
systemctl status mnscloud-webrtc-sync.service --no-pager -l'`;
  }
  notifyCommandCopied(copied: boolean) {
    copied
      ? this.snack.success('Install command copied.')
      : this.snack.error('Failed to copy install command.');
  }
  isSelected(row: WebRtcRecord) {
    return this.selected.has(this.uuid(row));
  }
  toggle(row: WebRtcRecord, checked: boolean) {
    checked ? this.selected.add(this.uuid(row)) : this.selected.delete(this.uuid(row));
  }
  visibleRows() {
    const rows = this.dataSource.filteredData;
    if (!this.paginator) return rows;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return rows.slice(start, start + this.paginator.pageSize);
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
    const result = await this.api.removeMany(this.config().resource, ids);
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
    await this.load();
  }
}
