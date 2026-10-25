import { Component, ViewEncapsulation, computed, inject, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { DetailPageComponent } from '../../../shared/pages/detail-page';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../shared/crud/configurable-crud/global-table';
import type { ConfigurableCrudRecord } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  CONNECTION_KINDS,
  PORT_KINDS,
  RELATION_KINDS,
  SPLITTER_PRESETS,
  type Row,
  fiberColor,
  portLabel,
  spliceDiagram,
} from './network-model';

type Option = { value: string; label: string };
type ImpactSummary = { ports: number; customers: number; online: number; rootsKnown: boolean };
type ListResponse = { data?: { items?: Row[] } };
type TraceResponse = {
  data?: {
    items?: Row[];
    budget?: {
      txPowerDbm: number;
      sensitivityDbm: number;
      terminals: number;
      bestLossDb: number | null;
      worstLossDb: number | null;
      belowSensitivity: number;
    };
  };
};

const items = async (request: Promise<ListResponse>) => (await request)?.data?.items ?? [];
const str = (value: unknown) => (typeof value === 'string' ? value : String(value ?? ''));

/**
 * InfraGIS › Network: ports, connections (splices, patches, drops), relations, splice diagram and
 * trace with power budget of one asset (box, cable, splitter, OLT, customer). Opened from the map.
 */
@Component({
  selector: 'app-infragis-network',
  standalone: true,
  imports: [
    DecimalPipe,
    DetailPageComponent,
    FieldHelpComponent,
    GlobalTableComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
    MnsSearchSelectFieldComponent,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './network.html',
  styleUrl: './network.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-fade-in-host' },
})
export class InfraGisNetworkPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snack = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);
  private readonly dialog = inject(MatDialog);

  readonly portKinds = PORT_KINDS;
  readonly connectionKinds = CONNECTION_KINDS;
  readonly relationKinds = RELATION_KINDS;
  readonly splitterPresets = SPLITTER_PRESETS.map(({ value, label }) => ({ value, label }));
  readonly fiberColor = fiberColor;

  private readonly can = (code: string) =>
    hasEffectivePermission(this.auth.user()?.permissions ?? [], code);
  readonly canWrite = computed(() => this.can('tenant.infragis.network.write'));
  readonly canDelete = computed(() => this.can('tenant.infragis.network.delete'));

  readonly assetUUID = signal(
    str(inject(ActivatedRoute).snapshot.queryParamMap.get('asset')).trim(),
  );
  readonly assetOptions = signal<Option[]>([]);

  private readonly asset = resource({
    params: () => this.assetUUID() || undefined,
    loader: async ({ params }) =>
      (await this.api.get<{ data?: { item?: Row } }>(`infragis/assets/${params}`))?.data?.item ??
      null,
  });
  readonly current = computed(() => this.asset.value() ?? null);
  readonly selectedOption = computed<Option[]>(() => {
    const asset = this.current();
    return asset ? [{ value: str(asset['IgaUUID']), label: str(asset['IgaName']) }] : [];
  });
  readonly pickerOptions = computed(() => {
    const seen = new Set<string>();
    return [...this.selectedOption(), ...this.assetOptions()].filter(
      (option) => !seen.has(option.value) && !!seen.add(option.value),
    );
  });

  private readonly network = resource({
    params: () => this.assetUUID() || undefined,
    loader: async ({ params }) => {
      const [ports, connections, splices, relations] = await Promise.all([
        items(this.api.get<ListResponse>(`infragis/assets/${params}/ports`)),
        items(this.api.get<ListResponse>(`infragis/connections?assetUUID=${params}`)),
        items(this.api.get<ListResponse>(`infragis/connections?locationUUID=${params}`)),
        items(this.api.get<ListResponse>(`infragis/assets/${params}/relations`)),
      ]);
      return { ports, connections, splices, relations };
    },
  });
  readonly loading = computed(() => this.asset.isLoading() || this.network.isLoading());
  readonly ports = computed(() =>
    (this.network.value()?.ports ?? []).map((port): Row => ({
      ...port,
      Name: portLabel(port['IptKind'], port['IptNumber'], port['IptTube']),
      OccupiedLabel: Number(port['Occupied']) ? 'Occupied' : 'Free',
      OnlineLabel:
        port['Online'] === null || port['Online'] === undefined || port['Online'] === 'NULL'
          ? ''
          : Number(port['Online'])
            ? 'Online'
            : 'Offline',
    })),
  );
  readonly portOptions = computed<Option[]>(() =>
    this.ports().map((port) => ({
      value: str(port['IptUUID']),
      label: `${port['Name']}${port['IptColor'] ? ` · ${port['IptColor']}` : ''}`,
    })),
  );
  readonly occupancy = computed(() => {
    const customer = this.ports().filter((port) => port['IptKind'] === 'PORT');
    return {
      total: customer.length,
      occupied: customer.filter((port) => Number(port['Occupied'])).length,
    };
  });
  readonly connections = computed(() =>
    (this.network.value()?.connections ?? []).map((row): Row => ({
      ...row,
      From: `${row['FromAssetName']} · ${portLabel(row['FromKind'], row['FromNumber'], row['FromTube'])}`,
      To: `${row['ToAssetName']} · ${portLabel(row['ToKind'], row['ToNumber'], row['ToTube'])}`,
    })),
  );
  readonly relations = computed(() => this.network.value()?.relations ?? []);
  readonly diagram = computed(() => spliceDiagram(this.network.value()?.splices ?? []));

  // ---------------- forms ----------------
  readonly generateKind = signal('PORT');
  readonly generateCount = signal<number | null>(8);
  readonly generateTube = signal<number | null>(12);
  readonly generateLoss = signal<number | null>(null);
  readonly splitterRatio = signal('');
  readonly busy = signal(false);

  readonly fromPort = signal('');
  readonly targetAsset = signal('');
  readonly targetOptions = signal<Option[]>([]);
  readonly targetPort = signal('');
  readonly connectionKind = signal('FUSION');
  readonly atThisAsset = signal(true);
  private readonly targetPorts = resource({
    params: () => this.targetAsset() || undefined,
    loader: async ({ params }) =>
      items(this.api.get<ListResponse>(`infragis/assets/${params}/ports`)),
  });
  readonly targetPortOptions = computed<Option[]>(() =>
    (this.targetPorts.value() ?? []).map((port) => ({
      value: str(port['IptUUID']),
      label: `${portLabel(port['IptKind'], port['IptNumber'], port['IptTube'])}${
        port['IptColor'] ? ` · ${port['IptColor']}` : ''
      }${Number(port['Occupied']) ? ` · ${this.transloco.translate('Occupied')}` : ''}`,
    })),
  );

  readonly relationKind = signal('CONTAINS');
  readonly relationAsset = signal('');

  // ---------------- platform links ----------------
  readonly popOptions = signal<Option[]>([]);
  readonly oltOptions = signal<Option[]>([]);
  readonly customerOptions = signal<Option[]>([]);
  readonly accessOptions = signal<Option[]>([]);
  readonly popUUID = signal('');
  readonly oltUUID = signal('');
  readonly linkPort = signal('');
  readonly linkCustomer = signal('');
  readonly linkAccess = signal('');
  private readonly platform = resource({
    params: () => this.assetUUID() || undefined,
    loader: async ({ params }) =>
      (await this.api.get<{ data?: { item?: Row } }>(`infragis/assets/${params}/platform`))?.data
        ?.item ?? null,
  });
  readonly platformLinks = computed(() => this.platform.value() ?? null);
  readonly customerPortOptions = computed(() =>
    this.portOptions().filter((option) =>
      this.ports().some((port) => port['IptUUID'] === option.value && port['IptKind'] === 'PORT'),
    ),
  );
  readonly currentPop = computed<Option[]>(() => {
    const links = this.platformLinks();
    return links?.['IspPopIppUUID']
      ? [{ value: str(links['IspPopIppUUID']), label: str(links['PopName']) }]
      : [];
  });
  readonly currentOlt = computed<Option[]>(() => {
    const links = this.platformLinks();
    return links?.['IspOltIolUUID']
      ? [{ value: str(links['IspOltIolUUID']), label: str(links['OltName']) }]
      : [];
  });

  // ---------------- impact ----------------
  readonly impactRows = signal<Row[]>([]);
  readonly impactSummary = signal<ImpactSummary | null>(null);
  readonly impactLabel = signal('');
  /** Failed element of the last impact: the asset or one of its ports. */
  readonly impactTarget = signal<{ assetUUID: string } | { portUUID: string } | null>(null);
  readonly impactLoading = signal(false);
  readonly impactTable = defineGlobalTable({
    key: 'infragis/network/impact',
    uuidField: 'IptUUID',
    emptyLabel: 'No customer port is cut off.',
    columns: [
      { id: 'box', label: 'Box', field: 'IgaName', translateValue: false },
      { id: 'port', label: 'Port', field: 'IptNumber', kind: 'number' },
      { id: 'customer', label: 'Customer', field: 'CustomerName', translateValue: false },
      { id: 'phone', label: 'Phone', field: 'CustomerPhone', translateValue: false },
      { id: 'login', label: 'Login', field: 'AccessLogin', translateValue: false },
      { id: 'online', label: 'Online', field: 'OnlineLabel' },
    ],
  });

  // ---------------- trace ----------------
  readonly tracePort = signal('');
  readonly txPower = signal<number | null>(5);
  readonly sensitivity = signal<number | null>(-27);
  readonly attenuation = signal<number | null>(0.35);
  private readonly trace = resource({
    params: () =>
      this.tracePort()
        ? {
            port: this.tracePort(),
            tx: this.txPower(),
            sensitivity: this.sensitivity(),
            attenuation: this.attenuation(),
          }
        : undefined,
    loader: async ({ params }) => {
      const query = new URLSearchParams();
      if (params.tx !== null) query.set('txPowerDbm', String(params.tx));
      if (params.sensitivity !== null) query.set('sensitivityDbm', String(params.sensitivity));
      if (params.attenuation !== null) query.set('attenuationDbKm', String(params.attenuation));
      return (await this.api.get<TraceResponse>(`infragis/ports/${params.port}/trace?${query}`))
        ?.data;
    },
  });
  readonly traceRows = computed(() =>
    (this.trace.value()?.items ?? []).map((row): Row => ({
      ...row,
      Port: portLabel(row['IptKind'], row['IptNumber'], row['IptTube']),
    })),
  );
  readonly budget = computed(() => this.trace.value()?.budget ?? null);
  readonly traceLoading = computed(() => this.trace.isLoading());

  // ---------------- tables ----------------
  readonly portTable = defineGlobalTable({
    key: 'infragis/network/ports',
    uuidField: 'IptUUID',
    emptyLabel: 'No ports yet.',
    columns: [
      { id: 'port', label: 'Port', field: 'Name', translateValue: false },
      { id: 'color', label: 'Fiber color', field: 'IptColor', translateValue: false },
      { id: 'tube', label: 'Tube color', field: 'TubeColor', translateValue: false },
      { id: 'label', label: 'Label', field: 'IptLabel', translateValue: false },
      { id: 'occupied', label: 'Occupancy', field: 'OccupiedLabel' },
      { id: 'state', label: 'State', field: 'IptState' },
      { id: 'to', label: 'Connected to', field: 'ConnectedTo', translateValue: false },
      { id: 'customer', label: 'Customer', field: 'CustomerName', translateValue: false },
      { id: 'login', label: 'Login', field: 'AccessLogin', translateValue: false },
      { id: 'online', label: 'Online', field: 'OnlineLabel' },
    ],
    rowActions: [
      { key: 'trace', label: 'Trace', icon: 'route', run: (row) => this.startTrace(row) },
      {
        key: 'impact',
        label: 'Outage impact',
        icon: 'crisis_alert',
        run: (row) => this.runImpact(row),
      },
      {
        key: 'reserve',
        label: 'Reserve',
        icon: 'bookmark_add',
        visible: (row) => this.canWrite() && row['IptState'] === 'free',
        run: (row) => this.setState(row, 'reserved'),
      },
      {
        key: 'free',
        label: 'Release',
        icon: 'bookmark_remove',
        visible: (row) => this.canWrite() && row['IptState'] !== 'free',
        run: (row) => this.setState(row, 'free'),
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: 'delete',
        visible: (row) => this.canDelete() && !Number(row['ConnectionCount']),
        run: (row) => this.remove(`infragis/ports/${row['IptUUID']}`, 'Port deleted.'),
      },
    ],
  });
  readonly connectionTable = defineGlobalTable({
    key: 'infragis/network/connections',
    uuidField: 'IcnUUID',
    emptyLabel: 'No connections yet.',
    columns: [
      { id: 'from', label: 'Side A', field: 'From', translateValue: false },
      { id: 'to', label: 'Side B', field: 'To', translateValue: false },
      { id: 'kind', label: 'Kind', field: 'IcnKind' },
      { id: 'loss', label: 'Loss (dB)', field: 'IcnLossDb', translateValue: false },
      { id: 'location', label: 'Location', field: 'LocationName', translateValue: false },
    ],
    rowActions: [
      {
        key: 'delete',
        label: 'Delete',
        icon: 'link_off',
        visible: () => this.canDelete(),
        run: (row) => this.remove(`infragis/connections/${row['IcnUUID']}`, 'Connection deleted.'),
      },
    ],
  });
  readonly relationTable = defineGlobalTable({
    key: 'infragis/network/relations',
    uuidField: 'IrlUUID',
    emptyLabel: 'No relations yet.',
    columns: [
      { id: 'from', label: 'Source asset', field: 'FromAssetName', translateValue: false },
      { id: 'kind', label: 'Kind', field: 'IrlKind' },
      { id: 'to', label: 'Target asset', field: 'ToAssetName', translateValue: false },
    ],
    rowActions: [
      {
        key: 'delete',
        label: 'Delete',
        icon: 'delete',
        visible: () => this.canDelete(),
        run: (row) => this.remove(`infragis/relations/${row['IrlUUID']}`, 'Relation deleted.'),
      },
    ],
  });
  readonly traceTable = defineGlobalTable({
    key: 'infragis/network/trace',
    uuidField: 'IptUUID',
    emptyLabel: 'Choose a port to trace.',
    columns: [
      { id: 'hops', label: 'Hops', field: 'Hops', kind: 'number' },
      { id: 'asset', label: 'Asset', field: 'IgaName', translateValue: false },
      { id: 'port', label: 'Port', field: 'Port', translateValue: false },
      { id: 'via', label: 'Via', field: 'ViaKind' },
      { id: 'loss', label: 'Loss (dB)', field: 'LossDb', translateValue: false },
      { id: 'power', label: 'Received power (dBm)', field: 'ReceivedPowerDbm', kind: 'number' },
      { id: 'margin', label: 'Margin (dB)', field: 'MarginDb', kind: 'number' },
    ],
  });

  // ---------------- actions ----------------
  refresh() {
    this.asset.reload();
    this.platform.reload();
    this.network.reload();
    this.trace.reload();
  }

  selectAsset(value: unknown) {
    const uuid = str(value);
    this.assetUUID.set(uuid);
    this.tracePort.set('');
    void this.router.navigate([], { queryParams: { asset: uuid || null }, replaceUrl: true });
  }

  async searchAssets(term: string, target: 'asset' | 'target') {
    const rows = await items(
      this.api.get<ListResponse>(
        `infragis/assets?limit=50&search=${encodeURIComponent(term.trim())}`,
      ),
    );
    const options = rows.map((row) => ({
      value: str(row['IgaUUID']),
      label: `${row['IgaName']}${row['AssetTypeName'] ? ` · ${row['AssetTypeName']}` : ''}`,
    }));
    (target === 'asset' ? this.assetOptions : this.targetOptions).set(options);
  }

  setSplitter(value: unknown) {
    const preset = SPLITTER_PRESETS.find((item) => item.value === str(value));
    this.splitterRatio.set(str(value));
    if (!preset) return;
    this.generateKind.set('SPLITTER_OUT');
    this.generateCount.set(preset.outputs);
    this.generateLoss.set(preset.lossDb);
  }

  numberValue(event: Event): number | null {
    const raw = (event.target as HTMLInputElement).value.trim().replace(',', '.');
    return raw === '' ? null : Number(raw);
  }

  async generatePorts() {
    await this.run(async () => {
      const asset = this.assetUUID();
      await this.api.post(`infragis/assets/${asset}/ports`, {
        kind: this.generateKind(),
        count: this.generateCount(),
        tubeSize: this.generateKind() === 'FIBER' ? this.generateTube() : null,
        lossDb: this.generateKind() === 'SPLITTER_OUT' ? this.generateLoss() : null,
      });
      // A splitter output set also needs its input.
      const hasInput = this.ports().some((port) => port['IptKind'] === 'SPLITTER_IN');
      if (this.generateKind() === 'SPLITTER_OUT' && !hasInput) {
        await this.api.post(`infragis/assets/${asset}/ports`, { kind: 'SPLITTER_IN', count: 1 });
      }
      this.snack.success('Ports added.');
    });
  }

  async connect() {
    await this.run(async () => {
      await this.api.post('infragis/connections', {
        fromPortUUID: this.fromPort(),
        toPortUUID: this.targetPort(),
        kind: this.connectionKind(),
        locationUUID: this.atThisAsset() ? this.assetUUID() : null,
      });
      this.targetPort.set('');
      this.targetPorts.reload();
      this.snack.success('Ports connected.');
    });
  }

  async relate() {
    await this.run(async () => {
      await this.api.post('infragis/relations', {
        fromAssetUUID: this.assetUUID(),
        toAssetUUID: this.relationAsset(),
        kind: this.relationKind(),
      });
      this.relationAsset.set('');
      this.snack.success('Relation added.');
    });
  }

  /** Remote options of a lookup list (name search) into one of the option signals. */
  async searchOptions(
    endpoint: string,
    uuidField: string,
    labelField: string,
    term: string,
    target: 'pop' | 'olt' | 'customer' | 'access',
  ) {
    const rows = await items(
      this.api.get<ListResponse>(`${endpoint}?limit=50&search=${encodeURIComponent(term.trim())}`),
    );
    const options = rows.map((row) => ({
      value: str(row[uuidField]),
      label: str(row[labelField]),
    }));
    ({
      pop: this.popOptions,
      olt: this.oltOptions,
      customer: this.customerOptions,
      access: this.accessOptions,
    })[target].set(options);
  }

  async savePlatform() {
    await this.run(async () => {
      await this.api.put(`infragis/assets/${this.assetUUID()}/platform`, {
        popUUID: this.popUUID() || str(this.platformLinks()?.['IspPopIppUUID'] ?? '') || '',
        oltUUID: this.oltUUID() || str(this.platformLinks()?.['IspOltIolUUID'] ?? '') || '',
      });
      this.platform.reload();
      this.snack.success('Platform links saved.');
    });
  }

  async clearPlatform() {
    await this.run(async () => {
      await this.api.put(`infragis/assets/${this.assetUUID()}/platform`, {
        popUUID: '',
        oltUUID: '',
      });
      this.popUUID.set('');
      this.oltUUID.set('');
      this.platform.reload();
      this.snack.success('Platform links saved.');
    });
  }

  async saveCustomer(clear = false) {
    await this.run(async () => {
      await this.api.put(
        `infragis/ports/${this.linkPort()}/customer`,
        clear
          ? { customerUUID: '', accessUUID: '' }
          : {
              ...(this.linkCustomer() ? { customerUUID: this.linkCustomer() } : {}),
              ...(this.linkAccess() ? { accessUUID: this.linkAccess() } : {}),
            },
      );
      this.linkCustomer.set('');
      this.linkAccess.set('');
      this.snack.success('Customer port saved.');
    });
  }

  async runImpact(row?: ConfigurableCrudRecord) {
    this.impactTarget.set(
      row ? { portUUID: str(row['IptUUID']) } : { assetUUID: this.assetUUID() },
    );
    const endpoint = row
      ? `infragis/ports/${row['IptUUID']}/impact`
      : `infragis/assets/${this.assetUUID()}/impact`;
    this.impactLabel.set(
      row
        ? `${this.current()?.['IgaName'] ?? ''} · ${portLabel(row['IptKind'], row['IptNumber'], row['IptTube'])}`
        : str(this.current()?.['IgaName']),
    );
    this.impactLoading.set(true);
    try {
      const response = await this.api.get<{
        data?: { items?: Row[]; summary?: ImpactSummary };
      }>(endpoint);
      this.impactRows.set(
        (response?.data?.items ?? []).map((item): Row => ({
          ...item,
          OnlineLabel:
            item['Online'] === null || item['Online'] === undefined
              ? ''
              : Number(item['Online'])
                ? 'Online'
                : 'Offline',
        })),
      );
      this.impactSummary.set(response?.data?.summary ?? null);
    } catch (error) {
      const body = (error as { error?: { error?: string } })?.error?.error;
      this.snack.error(this.transloco.translate(body || 'The impact could not be computed.'));
    } finally {
      this.impactLoading.set(false);
    }
  }

  /** Opens the canonical support ticket form with the outage summary and the affected customers. */
  async openIncident() {
    const rows = this.impactRows();
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(key, params);
    const lines = rows
      .slice(0, 200)
      .map(
        (row) =>
          `- ${row['IgaName']} #${row['IptNumber']}: ${row['CustomerName'] ?? '—'}${
            row['AccessLogin'] ? ` (${row['AccessLogin']})` : ''
          }`,
      );
    const { openQuickCreate } =
      await import('../../../shared/crud/configurable-crud/configurable-crud-quick-create-host');
    await openQuickCreate(this.dialog, {
      loadComponent: () =>
        import('../../support/tickets/tickets').then((m) => m.SupportTicketsPage),
      routeData: { supportDesk: 'tenant' },
      initialValues: {
        subject: t('Network outage: {{ asset }}', { asset: this.impactLabel() }).slice(0, 160),
        description: [
          t(
            '{{ count }} customer ports cut off ({{ customers }} customers, {{ online }} online now).',
            {
              count: rows.length,
              customers: this.impactSummary()?.customers ?? 0,
              online: this.impactSummary()?.online ?? 0,
            },
          ),
          '',
          ...lines,
        ].join('\n'),
      },
    });
  }

  /** Notice or credit form of the affected customers, prefilled with the failed element. */
  async openOutageAction(resource: 'outage-notices' | 'outage-credits') {
    const target = this.impactTarget();
    if (!target) return;
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(key, params);
    const day = new Date().toISOString().slice(0, 10);
    const { openQuickCreate } =
      await import('../../../shared/crud/configurable-crud/configurable-crud-quick-create-host');
    await openQuickCreate(this.dialog, {
      loadComponent: () => import('../utilities/utilities').then((m) => m.InfraGisUtilitiesPage),
      routeData: { resource },
      initialValues: {
        ...target,
        ...(resource === 'outage-notices'
          ? {
              subject: t('Network outage in your area').slice(0, 200),
              message: t(
                'We identified a failure in the network that serves your address. Our team is already working on it.',
              ),
            }
          : {
              outageKey: `${this.impactLabel()} ${day}`.slice(0, 120),
              mode: 'PRORATA',
              description: t('Credit for service unavailability on {{ day }}', { day }).slice(
                0,
                160,
              ),
            }),
      },
    });
  }

  startTrace(row: ConfigurableCrudRecord) {
    this.tracePort.set(str(row['IptUUID']));
  }

  printDiagram() {
    window.print();
  }

  private async setState(row: ConfigurableCrudRecord, state: string) {
    await this.run(() => this.api.put(`infragis/ports/${row['IptUUID']}`, { state }));
  }

  private async remove(endpoint: string, message: string) {
    await this.run(async () => {
      await this.api.delete(endpoint);
      this.snack.success(message);
    });
  }

  private async run(action: () => Promise<unknown>) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action();
      this.network.reload();
      if (this.tracePort()) this.trace.reload();
    } catch (error) {
      const body = (error as { error?: { error?: string } })?.error?.error;
      this.snack.error(this.transloco.translate(body || 'The operation failed.'));
    } finally {
      this.busy.set(false);
    }
  }
}
