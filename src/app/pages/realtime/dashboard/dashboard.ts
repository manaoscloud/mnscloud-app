import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

import { SnackbarService } from '../../../services/snackbar.service';
import { MnsDateTimePipe } from '../../../shared/date-time/date-time.pipe';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { RealtimeDashboardRecord, RealtimeDashboardService } from './dashboard.service';

type DashboardMode = 'overview' | 'media' | 'turn';

type DashboardFilters = {
  mode: DashboardMode;
  search: string;
  status: string;
};

type DashboardSnapshot = {
  domains: RealtimeDashboardRecord[];
  mediaServers: RealtimeDashboardRecord[];
  turnServers: RealtimeDashboardRecord[];
  turnDomains: RealtimeDashboardRecord[];
};

type KpiTile = {
  label: string;
  value: string;
  detail: string;
  icon: string;
};

type InventoryRow = {
  name: string;
  meta: string;
  status: string;
  statusClass: string;
  details: { label: string; value: string }[];
};

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  domains: [],
  mediaServers: [],
  turnServers: [],
  turnDomains: [],
};

@Component({
  selector: 'app-realtime-dashboard',
  standalone: true,
  imports: [
    MnsDateTimePipe,
    RefreshButtonComponent,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class RealtimeDashboardPage {
  private readonly api = inject(RealtimeDashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 5000;

  readonly mode = signal<DashboardMode>(this.route.snapshot.data?.['dashboardMode'] ?? 'overview');
  readonly searchInput = signal('');
  readonly statusInput = signal('');
  private readonly appliedFilters = signal<DashboardFilters>({
    mode: this.mode(),
    search: '',
    status: '',
  });

  private readonly snapshotResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: EMPTY_SNAPSHOT,
    loader: ({ params }) => this.loadSnapshot(params),
  });

  readonly loading = this.snapshotResource.isLoading;
  readonly snapshot = computed(() => this.snapshotResource.value());

  readonly title = computed(() => {
    if (this.mode() === 'media') return 'Media/RTP Dashboard';
    if (this.mode() === 'turn') return 'TURN/STUN Dashboard';
    return 'Realtime Dashboard';
  });

  readonly subtitle = computed(() => {
    if (this.mode() === 'media') {
      return 'Monitor RTP/media relay capacity, health and runtime sync.';
    }
    if (this.mode() === 'turn') {
      return 'Monitor TURN/STUN relay domains, certificates and runtime health.';
    }
    return 'Monitor realtime domains, media relay, TURN/STUN and edge runtime health.';
  });

  readonly kpis = computed<KpiTile[]>(() => {
    const snapshot = this.snapshot();
    const mediaOnline = snapshot.mediaServers.filter((item) => this.isOnline(item, 'Rms')).length;
    const turnOnline = snapshot.turnServers.filter((item) => this.isOnline(item, 'Rts')).length;
    const activeDomains = snapshot.domains.filter(
      (item) => this.statusNumber(this.field(item, 'RtdStatus')) === 1,
    );
    const readyTurnDomains = snapshot.turnDomains.filter(
      (item) => this.certStatus(item) === 'ready',
    ).length;
    const pendingTurnDomains = snapshot.turnDomains.filter(
      (item) => this.certStatus(item) === 'pending',
    ).length;
    const failedTurnDomains = snapshot.turnDomains.filter(
      (item) => this.certStatus(item) === 'failed',
    ).length;

    if (this.mode() === 'media') {
      return [
        this.tile(
          'Media Servers Online',
          this.ratio(mediaOnline, snapshot.mediaServers.length),
          'Online',
          'settings_ethernet',
        ),
        this.tile(
          'Media Port Range',
          this.mediaPortSummary(snapshot.mediaServers),
          'RTP/SRTP',
          'settings_input_hdmi',
        ),
        this.tile(
          'Control Endpoint',
          this.controlEndpointSummary(snapshot.mediaServers),
          'NG protocol',
          'hub',
        ),
        this.tile('Active Domains', String(activeDomains.length), 'Realtime domains', 'language'),
      ];
    }

    if (this.mode() === 'turn') {
      return [
        this.tile(
          'TURN/STUN Servers Online',
          this.ratio(turnOnline, snapshot.turnServers.length),
          'Online',
          'router',
        ),
        this.tile(
          'TURN/STUN Domains Ready',
          this.ratio(readyTurnDomains, snapshot.turnDomains.length),
          'Certificates',
          'verified',
        ),
        this.tile(
          'Certificate Pending',
          String(pendingTurnDomains),
          'Provision queue',
          'pending_actions',
        ),
        this.tile(
          'Certificate Failed',
          String(failedTurnDomains),
          'Requires review',
          'error_outline',
        ),
        this.tile('TLS Enabled', this.tlsSummary(snapshot.turnServers), 'Port 5349', 'lock'),
        this.tile(
          'Relay Capacity',
          this.relayRangeSummary(snapshot.turnServers),
          'Relay ports',
          'settings_ethernet',
        ),
      ];
    }

    return [
      this.tile('Realtime Domains', String(snapshot.domains.length), 'Source of truth', 'language'),
      this.tile(
        'Active Domains',
        String(activeDomains.length),
        'Enabled identities',
        'domain_verification',
      ),
      this.tile(
        'Media Servers Online',
        this.ratio(mediaOnline, snapshot.mediaServers.length),
        'RTP/SRTP relay',
        'settings_ethernet',
      ),
      this.tile(
        'TURN/STUN Servers Online',
        this.ratio(turnOnline, snapshot.turnServers.length),
        'NAT traversal',
        'router',
      ),
      this.tile(
        'TURN/STUN Domains Ready',
        this.ratio(readyTurnDomains, snapshot.turnDomains.length),
        'Certificates',
        'verified',
      ),
      this.tile('Certificate Failed', String(failedTurnDomains), 'Requires review', 'error_outline'),
    ];
  });

  readonly primaryTitle = computed(() =>
    this.mode() === 'turn'
      ? 'TURN/STUN Servers'
      : this.mode() === 'media'
        ? 'Media Servers'
        : 'Edge Inventory',
  );

  readonly secondaryTitle = computed(() =>
    this.mode() === 'turn'
      ? 'TURN/STUN Domains'
      : this.mode() === 'media'
        ? 'Realtime Domains'
        : 'Certificate Health',
  );

  readonly primaryRows = computed(() => {
    const snapshot = this.snapshot();
    if (this.mode() === 'turn') return snapshot.turnServers.map((item) => this.turnServerRow(item));
    if (this.mode() === 'media')
      return snapshot.mediaServers.map((item) => this.mediaServerRow(item));
    return [
      ...snapshot.mediaServers.map((item) => this.mediaServerRow(item)),
      ...snapshot.turnServers.map((item) => this.turnServerRow(item)),
    ];
  });

  readonly secondaryRows = computed(() => {
    const snapshot = this.snapshot();
    if (this.mode() === 'turn') return snapshot.turnDomains.map((item) => this.turnDomainRow(item));
    if (this.mode() === 'media') return snapshot.domains.map((item) => this.realtimeDomainRow(item));
    return snapshot.turnDomains.map((item) => this.turnDomainRow(item));
  });

  readonly noPrimaryLabel = computed(() =>
    this.mode() === 'turn'
      ? 'No TURN/STUN servers found.'
      : this.mode() === 'media'
        ? 'No media servers found.'
        : 'No realtime items found.',
  );

  readonly noSecondaryLabel = computed(() =>
    this.mode() === 'turn'
      ? 'No TURN/STUN domains found.'
      : this.mode() === 'media'
        ? 'No realtime domains found.'
        : 'No TURN/STUN domains found.',
  );

  private readonly reportDashboardError = effect(() => {
    const error = this.snapshotResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load realtime dashboard.'));
  });

  refreshList() {
    this.snapshotResource.reload();
  }

  applySearchFilters() {
    this.appliedFilters.set({
      mode: this.mode(),
      search: this.searchInput().trim(),
      status: this.statusInput(),
    });
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.statusInput.set('');
    this.applySearchFilters();
  }

  rowTrack(_: number, row: InventoryRow) {
    return `${row.name}:${row.meta}`;
  }

  private async loadSnapshot(filters: DashboardFilters): Promise<DashboardSnapshot> {
    const params = this.params(filters);
    const [domains, mediaServers, turnServers, turnDomains] = await Promise.all([
      filters.mode !== 'turn'
        ? this.safeList(this.api.listDomains(params))
        : this.safeList(this.api.listDomains({ ...params, purpose: 'turn' })),
      filters.mode !== 'turn' ? this.safeList(this.api.listMediaServers(params)) : [],
      filters.mode !== 'media' ? this.safeList(this.api.listTurnServers(params)) : [],
      filters.mode !== 'media' ? this.safeList(this.api.listTurnDomains(params)) : [],
    ]);
    return { domains, mediaServers, turnServers, turnDomains };
  }

  private params(filters: DashboardFilters) {
    return {
      limit: this.listLimit,
      search: filters.search || undefined,
      status: filters.status === '' ? null : Number(filters.status),
    };
  }

  private async safeList(request: Promise<any>): Promise<RealtimeDashboardRecord[]> {
    const response = await request;
    return this.extractItems(response);
  }

  private extractItems(response: any): RealtimeDashboardRecord[] {
    const data = response?.data ?? response;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.servers)) return data.servers;
    if (Array.isArray(data?.domains)) return data.domains;
    return [];
  }

  private tile(label: string, value: string, detail: string, icon: string): KpiTile {
    return { label, value, detail, icon };
  }

  private mediaServerRow(item: RealtimeDashboardRecord): InventoryRow {
    const online = this.isOnline(item, 'Rms');
    return {
      name: this.text(this.field(item, 'RmsName')),
      meta: this.text(this.field(item, 'RmsEngine') || 'rtpengine'),
      status: online ? 'Online' : 'Offline',
      statusClass: online ? 'chip-success' : 'chip-skipped',
      details: [
        { label: 'Domain', value: this.text(this.field(item, 'RtdName') || '-') },
        { label: 'Public IP', value: this.text(this.field(item, 'RmsPublicIP') || '-') },
        { label: 'Private IP', value: this.text(this.field(item, 'RmsPrivateIP') || '-') },
        {
          label: 'Control Endpoint',
          value: this.endpoint(this.field(item, 'RmsControlIP'), this.field(item, 'RmsControlPort')),
        },
        {
          label: 'Media Port Range',
          value: this.range(this.field(item, 'RmsMinMediaPort'), this.field(item, 'RmsMaxMediaPort')),
        },
        { label: 'Version', value: this.text(this.field(item, 'RmsVersion') || '-') },
        { label: 'Last Seen', value: this.field(item, 'RmsLastSeenAt') || '' },
      ],
    };
  }

  private turnServerRow(item: RealtimeDashboardRecord): InventoryRow {
    const online = this.isOnline(item, 'Rts');
    return {
      name: this.text(this.field(item, 'RtsName')),
      meta: this.text(this.field(item, 'RtsHostname') || this.field(item, 'RtdName') || '-'),
      status: online ? 'Online' : 'Offline',
      statusClass: online ? 'chip-success' : 'chip-skipped',
      details: [
        {
          label: 'Domain',
          value: this.text(this.field(item, 'RtdName') || this.field(item, 'DomainName') || '-'),
        },
        {
          label: 'Public IP',
          value: this.text(
            this.field(item, 'RtsPublicIP') || this.field(item, 'RtsExternalIP') || '-',
          ),
        },
        { label: 'Private IP', value: this.text(this.field(item, 'RtsPrivateIP') || '-') },
        {
          label: 'Relay Port Range',
          value: this.range(this.field(item, 'RtsMinRelayPort'), this.field(item, 'RtsMaxRelayPort')),
        },
        { label: 'TLS Port', value: this.text(this.field(item, 'RtsTlsListeningPort') || '-') },
        { label: 'Version', value: this.text(this.field(item, 'RtsVersion') || '-') },
        { label: 'Last Seen', value: this.field(item, 'RtsLastSeenAt') || '' },
      ],
    };
  }

  private turnDomainRow(item: RealtimeDashboardRecord): InventoryRow {
    const status = this.certStatus(item);
    return {
      name: this.text(this.field(item, 'DomainName') || this.field(item, 'RtdName')),
      meta: this.text(this.field(item, 'RtsName') || this.field(item, 'RtdPurpose') || 'turn'),
      status: this.certificateLabel(status),
      statusClass:
        status === 'ready' ? 'chip-success' : status === 'failed' ? 'chip-danger' : 'chip-running',
      details: [
        { label: 'Server', value: this.text(this.field(item, 'RtsName') || '-') },
        {
          label: 'Certificate Provider',
          value: this.text(this.field(item, 'RtnCertificateProvider') || '-'),
        },
        { label: 'Certificate Status', value: this.certificateLabel(status) },
        { label: 'Last Sync', value: this.field(item, 'RtnLastSyncedAt') || '' },
      ],
    };
  }

  private realtimeDomainRow(item: RealtimeDashboardRecord): InventoryRow {
    const active = this.statusNumber(this.field(item, 'RtdStatus')) === 1;
    return {
      name: this.text(this.field(item, 'RtdName')),
      meta: this.purposeLabel(this.field(item, 'RtdPurpose')),
      status: active ? 'Active' : 'Inactive',
      statusClass: active ? 'chip-success' : 'chip-skipped',
      details: [
        { label: 'Purpose', value: this.purposeLabel(this.field(item, 'RtdPurpose')) },
        { label: 'Status', value: active ? 'Active' : 'Inactive' },
        { label: 'Updated', value: this.field(item, 'DateUpdated') || '' },
      ],
    };
  }

  private isOnline(item: RealtimeDashboardRecord, prefix: string) {
    const status = this.statusNumber(item[`${prefix}Status`]) === 1;
    const lastSeenAt = item[`${prefix}LastSeenAt`];
    return status && this.isRecent(lastSeenAt);
  }

  private isRecent(value: unknown) {
    if (!value) return false;
    const timestamp = Date.parse(String(value));
    if (!Number.isFinite(timestamp)) return false;
    return Date.now() - timestamp <= 10 * 60 * 1000;
  }

  private statusNumber(value: unknown) {
    return Number(value ?? 0);
  }

  private certStatus(item: RealtimeDashboardRecord) {
    return String(
      this.field(item, 'RtnCertificateStatus') ||
        this.field(item, 'RtnProvisionStatus') ||
        'unknown',
    ).toLowerCase();
  }

  private certificateLabel(status: string) {
    if (status === 'ready' || status === 'success') return 'Ready';
    if (status === 'failed' || status === 'error') return 'Failed';
    if (status === 'pending' || status === 'queued') return 'Pending';
    return 'Unknown';
  }

  private purposeLabel(value: unknown) {
    const purpose = String(value || 'unknown').toLowerCase();
    if (purpose === 'turn') return 'TURN/STUN';
    if (purpose === 'webrtc') return 'WebRTC';
    if (purpose === 'media') return 'Media/RTP';
    return 'Unknown';
  }

  private endpoint(host: unknown, port: unknown) {
    if (!host && !port) return '-';
    return `${host || '0.0.0.0'}:${port || '-'}`;
  }

  private range(min: unknown, max: unknown) {
    if (!min && !max) return '-';
    return `${min || '-'}-${max || '-'}`;
  }

  private ratio(current: number, total: number) {
    return `${current}/${total}`;
  }

  private mediaPortSummary(items: RealtimeDashboardRecord[]) {
    const ranges = items.map((item) =>
      this.range(this.field(item, 'RmsMinMediaPort'), this.field(item, 'RmsMaxMediaPort')),
    );
    return this.firstDistinct(ranges);
  }

  private controlEndpointSummary(items: RealtimeDashboardRecord[]) {
    const endpoints = items.map((item) =>
      this.endpoint(this.field(item, 'RmsControlIP'), this.field(item, 'RmsControlPort')),
    );
    return this.firstDistinct(endpoints);
  }

  private tlsSummary(items: RealtimeDashboardRecord[]) {
    const enabled = items.filter(
      (item) => Number(this.field(item, 'RtsTlsListeningPort') || 0) > 0,
    ).length;
    return this.ratio(enabled, items.length);
  }

  private relayRangeSummary(items: RealtimeDashboardRecord[]) {
    const ranges = items.map((item) =>
      this.range(this.field(item, 'RtsMinRelayPort'), this.field(item, 'RtsMaxRelayPort')),
    );
    return this.firstDistinct(ranges);
  }

  private firstDistinct(values: string[]) {
    const clean = Array.from(new Set(values.filter((value) => value && value !== '-')));
    if (clean.length === 0) return '-';
    if (clean.length === 1) return clean[0];
    return `${clean.length} ranges`;
  }

  private text(value: unknown) {
    const text = String(value ?? '').trim();
    return text || '-';
  }

  private field(item: RealtimeDashboardRecord, key: string) {
    return item[key];
  }

  private errorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message || fallback;
    const maybeError = error as { error?: string; message?: string };
    return maybeError?.error || maybeError?.message || fallback;
  }
}
