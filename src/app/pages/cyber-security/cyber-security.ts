import { NgClass, JsonPipe, DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  TemplateRef,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form as createForm, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../../services/api.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../shared/refresh-button/refresh-button';

type CyberRecord = {
  [key: string]: any;
  uuid?: string;
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  defaultPorts?: unknown;
  logPaths?: unknown;
  crowdsecCollections?: unknown;
  enabled?: number;
  serviceSlug?: string | null;
  serviceSlugs?: string;
  mode?: string;
  level?: string;
  profileName?: string | null;
  defaultDecisionDuration?: string;
  trustedNetworks?: unknown;
  rules?: unknown;
  listType?: string;
  value?: string;
  scope?: string;
  reason?: string;
  agentUUID?: string;
  serverUUID?: string | null;
  profileUUID?: string;
  servers?: number;
  protectedServers?: number;
  attentionServers?: number;
  activeDecisions?: number;
  openAlerts?: number;
  trustedNodes?: number;
  networkPolicies?: number;
  securityEvents24h?: number;
  agentName?: string;
  agentHostname?: string;
  agentConnectionStatus?: string;
  jobUUID?: string;
  command?: string;
  status?: string;
  dateCreated?: string;
  progressStep?: string;
  progressPercent?: number;
  progressMessage?: string;
  progress?: CyberProgressEvent[];
  attemptCount?: number;
  errorCode?: string;
  errorMessage?: string;
  nodeUUID?: string;
  nodeType?: string;
  hostname?: string;
  allowedNetworks?: unknown;
  endpointGroups?: unknown;
  authMode?: string;
  secretVersion?: number;
  lastSeenAt?: string;
  lastSeenIP?: string;
  notes?: string;
  endpointGroup?: string;
  action?: string;
  priority?: number;
  networks?: unknown;
  methods?: unknown;
  rateLimitPerMinute?: number | null;
  burst?: number | null;
  trustedNodeUUID?: string | null;
  trustedNodeName?: string | null;
  eventType?: string;
  decision?: string;
  decisionUUID?: string | null;
  enforcementStatus?: string | null;
  enforcementAction?: string | null;
  enforcementExpiresAt?: string | null;
  sourceIP?: string;
  origin?: string;
  startedAt?: string;
  expiresAt?: string;
  serverName?: string | null;
  serverHostname?: string | null;
  serverPrivateIP?: string | null;
  serverPublicIP?: string | null;
  method?: string;
  path?: string;
  scenario?: string | null;
  message?: string | null;
  details?: unknown;
  detectedAt?: string;
  policyName?: string | null;
};

type CyberProgressEvent = {
  at?: string;
  step?: string;
  percent?: number;
  message?: string;
  status?: string;
  output?: string;
  error?: string;
};

type CyberFilters = {
  search: string;
  serverUUID: string;
  status: string;
  level: string;
  serviceSlug: string;
  sourceIP: string;
  action: string;
  origin: string;
};

type CyberSnapshot = {
  dashboard: CyberRecord;
  servers: CyberRecord[];
  services: CyberRecord[];
  profiles: CyberRecord[];
  decisions: CyberRecord[];
  alerts: CyberRecord[];
  listEntries: CyberRecord[];
  trustedNodes: CyberRecord[];
  securityEvents: CyberRecord[];
};

const EMPTY_CYBER_SNAPSHOT: CyberSnapshot = {
  dashboard: {},
  servers: [],
  services: [],
  profiles: [],
  decisions: [],
  alerts: [],
  listEntries: [],
  trustedNodes: [],
  securityEvents: [],
};

@Component({
  selector: 'app-cyber-security',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    RouterLink,
    TranslocoPipe,
    DatePipe,
    JsonPipe,
    NgClass,
  ],
  templateUrl: './cyber-security.html',
  styleUrls: ['./cyber-security.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CyberSecurityPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly listDialog = viewChild<TemplateRef<unknown>>('listDialog');
  readonly jobDialog = viewChild<TemplateRef<unknown>>('jobDialog');
  readonly alertDialog = viewChild<TemplateRef<unknown>>('alertDialog');
  readonly decisionDialog = viewChild<TemplateRef<unknown>>('decisionDialog');

  private readonly appliedFilters = signal<CyberFilters>({
    search: '',
    serverUUID: '',
    status: '',
    level: '',
    serviceSlug: '',
    sourceIP: '',
    action: '',
    origin: '',
  });
  private readonly cyberResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: EMPTY_CYBER_SNAPSHOT,
    loader: ({ params }) => this.fetchCyberSnapshot(params),
  });

  readonly loading = this.cyberResource.isLoading;
  readonly dashboard = signal<CyberRecord>({});
  readonly servers = signal<CyberRecord[]>([]);
  readonly services = signal<CyberRecord[]>([]);
  readonly profiles = signal<CyberRecord[]>([]);
  readonly decisions = signal<CyberRecord[]>([]);
  readonly alerts = signal<CyberRecord[]>([]);
  readonly listEntries = signal<CyberRecord[]>([]);
  readonly trustedNodes = signal<CyberRecord[]>([]);
  readonly securityEvents = signal<CyberRecord[]>([]);
  readonly editingListEntry = signal<CyberRecord | null>(null);
  readonly serverProfileSearch = signal('');
  readonly selectedServer = signal<CyberRecord | null>(null);
  readonly selectedJobs = signal<CyberRecord[]>([]);
  readonly selectedAlert = signal<CyberRecord | null>(null);
  readonly selectedDecision = signal<CyberRecord | null>(null);
  readonly activeSection = signal<CyberSection>('dashboard');
  readonly alertServerSearch = signal('');
  readonly alertServiceSearch = signal('');
  readonly decisionDataSource = new MatTableDataSource<CyberRecord>([]);
  readonly alertDataSource = new MatTableDataSource<CyberRecord>([]);

  readonly decisionPaginator = viewChild<MatPaginator>('decisionPaginator');
  readonly decisionSort = viewChild<MatSort>('decisionSort');
  readonly alertPaginator = viewChild<MatPaginator>('alertPaginator');
  readonly alertSort = viewChild<MatSort>('alertSort');
  private readonly bindTableQueries = effect(() => {
    this.decisionDataSource.paginator = this.decisionPaginator() ?? null;
    this.decisionDataSource.sort = this.decisionSort() ?? null;
    this.alertDataSource.paginator = this.alertPaginator() ?? null;
    this.alertDataSource.sort = this.alertSort() ?? null;
  });

  private readonly syncCyberData = effect(() => {
    const snapshot = this.cyberResource.value();
    this.dashboard.set(snapshot.dashboard);
    this.servers.set(snapshot.servers);
    this.services.set(snapshot.services);
    this.profiles.set(snapshot.profiles);
    this.decisions.set(snapshot.decisions);
    this.decisionDataSource.data = snapshot.decisions;
    this.alerts.set(snapshot.alerts);
    this.alertDataSource.data = snapshot.alerts;
    this.listEntries.set(snapshot.listEntries);
    this.trustedNodes.set(snapshot.trustedNodes);
    this.securityEvents.set(snapshot.securityEvents);
  });

  private readonly reportCyberError = effect(() => {
    const error = this.cyberResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load Cyber Security.'));
  });

  readonly sections: Array<{
    key: CyberSection;
    label: string;
    icon: string;
    description: string;
  }> = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      description: 'Security posture and operational priorities.',
    },
    {
      key: 'servers',
      label: 'Servers',
      icon: 'dns',
      description: 'Agents, protection state, CrowdSec and bouncer health.',
    },
    {
      key: 'profiles',
      label: 'Security Profiles',
      icon: 'shield',
      description: 'Reusable protection policies for Linux services.',
    },
    {
      key: 'decisions',
      label: 'Decisions',
      icon: 'gavel',
      description: 'Active security decisions currently enforced by CrowdSec.',
    },
    {
      key: 'alerts',
      label: 'Alerts',
      icon: 'notification_important',
      description: 'Open security findings that need operator review.',
    },
    {
      key: 'lists',
      label: 'Allowlist / Blocklist',
      icon: 'rule',
      description: 'Explicit allow and block entries for trusted operations.',
    },
    {
      key: 'trusted-nodes',
      label: 'Trusted Nodes',
      icon: 'hub',
      description: 'Authenticated infrastructure nodes and agent-backed integrations.',
    },
    {
      key: 'network-policies',
      label: 'Network Policies',
      icon: 'policy',
      description: 'Endpoint groups, node scopes, rate limits and enforcement mode.',
    },
    {
      key: 'security-events',
      label: 'Security Events',
      icon: 'manage_search',
      description: 'Audited decisions for trusted access, deny, rate limit and monitor events.',
    },
  ];

  readonly currentSection = computed(
    () => this.sections.find((section) => section.key === this.activeSection()) ?? this.sections[0],
  );
  readonly dashboardKpis = computed(() => {
    const item = this.dashboard();
    return [
      {
        label: 'Protected coverage',
        value: this.ratio(item.protectedServers, item.servers),
        icon: 'admin_panel_settings',
      },
      {
        label: 'Needs attention',
        value: this.number(item.attentionServers),
        icon: 'report_problem',
      },
      {
        label: 'Open alerts',
        value: this.number(item.openAlerts),
        icon: 'notification_important',
      },
      {
        label: 'Active decisions',
        value: this.number(item.activeDecisions),
        icon: 'gavel',
      },
      {
        label: 'Trusted nodes',
        value: this.number(item.trustedNodes),
        icon: 'hub',
      },
      {
        label: 'Events 24h',
        value: this.number(item.securityEvents24h),
        icon: 'manage_search',
      },
    ];
  });
  readonly postureMetrics = computed(() => {
    const item = this.dashboard();
    const total = Number(item.servers ?? 0);
    return [
      {
        label: 'Servers enrolled',
        value: this.number(item.servers),
        percent: total > 0 ? 100 : 0,
      },
      {
        label: 'Protected servers',
        value: this.number(item.protectedServers),
        percent: this.percent(item.protectedServers, item.servers),
      },
      {
        label: 'Needs attention',
        value: this.number(item.attentionServers),
        percent: this.percent(item.attentionServers, item.servers),
      },
      {
        label: 'Open alerts',
        value: this.number(item.openAlerts),
        percent: this.percent(item.openAlerts, item.servers || item.openAlerts),
      },
    ];
  });
  readonly filteredProfiles = computed(() => {
    const search = this.serverProfileSearch().trim().toLowerCase();
    if (!search) return this.profiles();
    return this.profiles().filter((profile) =>
      `${profile.name ?? ''} ${profile.description ?? ''} ${profile.serviceSlugs ?? ''}`
        .toLowerCase()
        .includes(search),
    );
  });
  readonly filteredAlertServers = computed(() => {
    const search = this.alertServerSearch().trim().toLowerCase();
    if (!search) return this.servers();
    return this.servers().filter((server) =>
      `${this.serverLabel(server)} ${this.serverDetail(server)}`.toLowerCase().includes(search),
    );
  });
  readonly filteredAlertServices = computed(() => {
    const search = this.alertServiceSearch().trim().toLowerCase();
    if (!search) return this.services();
    return this.services().filter((service) =>
      `${service.name ?? ''} ${service.slug ?? ''} ${service.description ?? ''}`
        .toLowerCase()
        .includes(search),
    );
  });

  readonly serverColumns = [
    'agent',
    'profile',
    'protection',
    'job',
    'crowdsec',
    'bouncer',
    'lastSync',
    'actions',
  ];
  readonly decisionColumns = [
    'server',
    'value',
    'status',
    'action',
    'origin',
    'service',
    'scenario',
    'started',
    'expires',
    'actions',
  ];
  readonly alertColumns = [
    'server',
    'level',
    'status',
    'enforcement',
    'service',
    'message',
    'detectedAt',
    'actions',
  ];
  readonly listColumns = ['type', 'value', 'scope', 'reason', 'actions'];
  readonly securityEventColumns = [
    'detectedAt',
    'decision',
    'endpointGroup',
    'source',
    'node',
    'reason',
  ];

  readonly filterFormModel = signal({
    search: '',
    serverUUID: '',
    status: '',
    level: '',
    serviceSlug: '',
    sourceIP: '',
    action: '',
    origin: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  readonly listFormModel = signal({
    listType: 'allowlist',
    value: '',
    scope: 'ip',
    reason: '',
    enabled: 1,
  });
  readonly listForm = createForm(this.listFormModel, (path) => {
    required(path.listType);
    required(path.value);
    required(path.scope);
  });

  constructor() {
    this.decisionDataSource.sortingDataAccessor = (row, column) => {
      switch (column) {
        case 'server':
          return this.serverLabel(row);
        case 'service':
          return this.serviceLabel(row.serviceSlug);
        case 'expires':
          return row.expiresAt ?? '';
        case 'started':
          return row.startedAt ?? row.dateCreated ?? '';
        default:
          return row[column] ?? '';
      }
    };
    this.alertDataSource.sortingDataAccessor = (row, column) => {
      switch (column) {
        case 'server':
          return this.serverLabel(row);
        case 'service':
          return this.serviceLabel(row.serviceSlug);
        case 'source':
          return row.sourceIP ?? '';
        case 'enforcement':
          return row.enforcementAction ?? row.enforcementStatus ?? '';
        case 'detectedAt':
          return row.detectedAt ?? row.dateCreated ?? '';
        default:
          return row[column] ?? '';
      }
    };
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.activeSection.set(this.normalizeSection(params.get('section')));
    });
    this.refreshList();
  }

  routeFor(section: CyberSection) {
    const base = this.router.url.startsWith('/system/cyber-security')
      ? '/system/cyber-security'
      : '/cyber-security';
    return section === 'dashboard' ? base : `${base}/${section}`;
  }

  refreshList() {
    this.cyberResource.reload();
  }

  private async fetchCyberSnapshot(filters: CyberFilters): Promise<CyberSnapshot> {
    const query = this.queryString(filters);
    const decisionQuery = this.decisionQueryString(filters);
    const alertQuery = this.alertQueryString(filters);
    const [
      dashboard,
      servers,
      services,
      profiles,
      decisions,
      alerts,
      lists,
      trustedNodes,
      securityEvents,
    ] = await Promise.all([
      this.api.get<any>('cyber-security/dashboard'),
      this.api.get<any>(`cyber-security/servers${query}`),
      this.api.get<any>(`cyber-security/services${query}`),
      this.api.get<any>(`cyber-security/profiles${query}`),
      this.api.get<any>(`cyber-security/decisions${decisionQuery}`),
      this.api.get<any>(`cyber-security/alerts${alertQuery}`),
      this.api.get<any>(`cyber-security/lists${query}`),
      this.api.get<any>(`cyber-security/trusted-nodes${query}`),
      this.api.get<any>(`cyber-security/security-events${query}`),
    ]);
    return {
      dashboard: dashboard?.data ?? {},
      servers: servers?.data?.items ?? [],
      services: services?.data?.items ?? [],
      profiles: profiles?.data?.items ?? [],
      decisions: decisions?.data?.items ?? [],
      alerts: alerts?.data?.items ?? [],
      listEntries: lists?.data?.items ?? [],
      trustedNodes: trustedNodes?.data?.items ?? [],
      securityEvents: securityEvents?.data?.items ?? [],
    };
  }

  applyFilters() {
    this.resetDecisionPaginator();
    this.resetAlertPaginator();
    this.appliedFilters.set(this.currentFilters());
  }

  clearFilters() {
    this.filterFormModel.set({
      search: '',
      serverUUID: '',
      status: '',
      level: '',
      serviceSlug: '',
      sourceIP: '',
      action: '',
      origin: '',
    });
    this.alertServerSearch.set('');
    this.alertServiceSearch.set('');
    this.resetDecisionPaginator();
    this.resetAlertPaginator();
    this.applyFilters();
  }

  clearServerProfileSearch(open: boolean) {
    if (!open) this.serverProfileSearch.set('');
  }

  clearAlertServerSearch(open: boolean) {
    if (!open) this.alertServerSearch.set('');
  }

  clearAlertServiceSearch(open: boolean) {
    if (!open) this.alertServiceSearch.set('');
  }

  resetAlertPaginator() {
    this.alertDataSource.paginator?.firstPage();
  }

  resetDecisionPaginator() {
    this.decisionDataSource.paginator?.firstPage();
  }

  openListEntry(row?: CyberRecord, listType = 'allowlist') {
    this.editingListEntry.set(row ?? null);
    this.listFormModel.set({
      listType: row?.listType ?? listType,
      value: row?.value ?? '',
      scope: row?.scope ?? 'ip',
      reason: row?.reason ?? '',
      enabled: row?.enabled ?? 1,
    });
    this.openDialog(this.listDialog());
  }

  async saveListEntry() {
    if (!this.listForm().valid()) return;
    const row = this.editingListEntry();
    await this.save(
      row ? `cyber-security/lists/${row.uuid}` : 'cyber-security/lists',
      this.listFormModel(),
      !!row,
    );
  }

  async deleteListEntry(row: CyberRecord) {
    await this.remove(`cyber-security/lists/${row.uuid}`);
  }

  async requestStatusRefresh(row: CyberRecord) {
    if (!row.agentUUID) return;
    await this.api.post('cyber-security/servers/jobs', {
      agentUUID: row.agentUUID,
      command: 'cyber.security.status',
      payload: {},
    });
    this.snack.success('Security status refresh started.');
    this.refreshList();
  }

  async queueInstall(row: CyberRecord) {
    if (!row.agentUUID) return;
    await this.api.post('cyber-security/servers/jobs', {
      agentUUID: row.agentUUID,
      command: 'cyber.security.install',
      payload: {
        collections: ['crowdsecurity/linux', 'crowdsecurity/sshd'],
      },
    });
    this.snack.success('Protection install job started.');
    this.refreshList();
  }

  async queueProfileApply(row: CyberRecord) {
    if (!row.agentUUID || !row.profileUUID) return;
    await this.api.post('cyber-security/servers/jobs', {
      agentUUID: row.agentUUID,
      profileUUID: row.profileUUID,
      command: 'cyber.security.profile.apply',
      payload: {},
    });
    this.snack.success('Security profile apply job started.');
    this.refreshList();
  }

  async assignServerProfile(row: CyberRecord, profileUUID: string | null) {
    if (!row.agentUUID) return;
    const previousProfileUUID = row.profileUUID ?? null;
    row.profileUUID = profileUUID ?? undefined;
    row.profileName = profileUUID
      ? this.profiles().find((profile) => profile.uuid === profileUUID)?.name
      : null;
    try {
      await this.api.post('cyber-security/servers/profile', {
        agentUUID: row.agentUUID,
        profileUUID,
      });
      this.snack.success(profileUUID ? 'Security profile assigned.' : 'Security profile removed.');
      this.refreshList();
    } catch (error) {
      row.profileUUID = previousProfileUUID ?? undefined;
      row.profileName = previousProfileUUID
        ? this.profiles().find((profile) => profile.uuid === previousProfileUUID)?.name
        : null;
      this.snack.error(this.errorMessage(error, 'Failed to assign security profile.'));
    }
  }

  async openJobDetails(row: CyberRecord) {
    if (!row.agentUUID) return;
    this.selectedServer.set(row);
    this.selectedJobs.set([]);
    this.openDialog(this.jobDialog(), '1100px');
    try {
      const params = new URLSearchParams({
        agentUUID: row.agentUUID,
        limit: '20',
      });
      const response = await this.api.get<any>(`cyber-security/jobs?${params.toString()}`);
      this.selectedJobs.set(response?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load job details.'));
    }
  }

  progressEvents(job: CyberRecord) {
    return Array.isArray(job.progress) ? job.progress : [];
  }

  jobProgress(job: CyberRecord) {
    const value = Number(job.progressPercent ?? 0);
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
  }

  openAlertDetails(row: CyberRecord) {
    this.selectedAlert.set(row);
    this.openDialog(this.alertDialog(), '980px');
  }

  openDecisionDetails(row: CyberRecord) {
    this.selectedDecision.set(row);
    this.openDialog(this.decisionDialog(), '980px');
  }

  async updateAlertStatus(row: CyberRecord, status: string) {
    if (!row.uuid) return;
    const previous = row.status;
    row.status = status;
    try {
      await this.api.put(`cyber-security/alerts/${row.uuid}/status`, { status });
      this.snack.success('Alert updated.');
      this.refreshList();
    } catch (error) {
      row.status = previous;
      this.snack.error(this.errorMessage(error, 'Failed to update alert.'));
    }
  }

  chipClass(value: string | null | undefined) {
    return `chip-${value || 'none'}`;
  }

  formatJson(value: unknown) {
    if (!value) return '-';
    if (Array.isArray(value)) return value.join(', ') || '-';
    return JSON.stringify(value);
  }

  formatList(value: unknown) {
    if (!value) return '-';
    if (Array.isArray(value)) return value.map((item) => String(item)).join(', ') || '-';
    return String(value);
  }

  formatPorts(value: unknown) {
    if (!Array.isArray(value)) return this.formatList(value);
    const ports = value.map((item) => {
      if (!item || typeof item !== 'object') return String(item);
      const entry = item as Record<string, unknown>;
      const protocol = String(entry['protocol'] ?? '').toUpperCase();
      const port = entry['port'] ?? entry['range'] ?? '';
      return [protocol, port].filter(Boolean).join(' ');
    });
    return ports.join(', ') || '-';
  }

  trustedNodeLabel(uuid: string | null | undefined) {
    if (!uuid) return 'Any trusted node';
    return this.trustedNodes().find((node) => node.uuid === uuid)?.name ?? uuid;
  }

  serverOptionValue(row: CyberRecord) {
    return row.uuid || row.serverUUID || '';
  }

  serverLabel(row: CyberRecord | string | null | undefined): string {
    if (!row) return '-';
    if (typeof row === 'string') {
      const server = this.servers().find((item) => item.uuid === row || item.serverUUID === row);
      return server ? this.serverLabel(server) : row;
    }
    return (
      row.serverName ||
      row.agentName ||
      row.serverHostname ||
      row.agentHostname ||
      row.hostname ||
      row.agentUUID ||
      row.serverUUID ||
      '-'
    );
  }

  serverDetail(row: CyberRecord) {
    return (
      row.serverPrivateIP || row.serverPublicIP || row.agentHostname || row.serverHostname || ''
    );
  }

  serviceLabel(slug: string | null | undefined) {
    if (!slug) return '-';
    return this.services().find((service) => service.slug === slug)?.name ?? slug;
  }

  private async save(endpoint: string, payload: Record<string, any>, update: boolean) {
    try {
      if (update) await this.api.put(endpoint, payload);
      else await this.api.post(endpoint, payload);
      this.dialog.closeAll();
      this.snack.success('Saved successfully.');
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to save.'));
    }
  }

  private async remove(endpoint: string) {
    try {
      await this.api.delete(endpoint);
      this.snack.success('Deleted successfully.');
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete.'));
    }
  }

  private openDialog(template?: TemplateRef<unknown>, width = '920px') {
    if (!template) return;
    this.dialog.open(template, {
      width,
      maxWidth: '96vw',
      maxHeight: '88vh',
    });
  }

  private queryString(filters: CyberFilters) {
    const search = filters.search.trim();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('limit', '1000');
    return `?${params.toString()}`;
  }

  private alertQueryString(filters: CyberFilters) {
    const params = new URLSearchParams();
    if (filters.search.trim()) params.set('search', filters.search.trim());
    if (filters.serverUUID) params.set('serverUUID', filters.serverUUID);
    if (filters.status) params.set('status', filters.status);
    if (filters.level) params.set('level', filters.level);
    if (filters.serviceSlug) params.set('serviceSlug', filters.serviceSlug);
    if (filters.sourceIP.trim()) params.set('sourceIP', filters.sourceIP.trim());
    params.set('limit', '1000');
    return `?${params.toString()}`;
  }

  private decisionQueryString(filters: CyberFilters) {
    const params = new URLSearchParams();
    if (filters.search.trim()) params.set('search', filters.search.trim());
    if (filters.serverUUID) params.set('serverUUID', filters.serverUUID);
    if (filters.status) params.set('status', filters.status);
    if (filters.action) params.set('action', filters.action);
    if (filters.origin) params.set('origin', filters.origin);
    if (filters.serviceSlug) params.set('serviceSlug', filters.serviceSlug);
    if (filters.sourceIP.trim()) params.set('sourceIP', filters.sourceIP.trim());
    params.set('limit', '1000');
    return `?${params.toString()}`;
  }

  private pretty(value: unknown) {
    return JSON.stringify(value ?? null, null, 2);
  }

  private parseJsonFields(payload: Record<string, any>, fields: string[]) {
    const next = { ...payload };
    for (const field of fields) {
      try {
        next[field] = JSON.parse(String(next[field] || 'null'));
      } catch {
        throw new Error(`${field} must be valid JSON.`);
      }
    }
    return next;
  }

  private currentFilters(): CyberFilters {
    return this.filterFormModel();
  }

  private errorMessage(error: any, fallback: string) {
    return error?.error?.error || error?.message || fallback;
  }

  private normalizeSection(value: string | null): CyberSection {
    const section = value || 'dashboard';
    return this.sections.some((item) => item.key === section)
      ? (section as CyberSection)
      : 'dashboard';
  }

  private number(value: unknown) {
    return String(Number(value ?? 0));
  }

  private ratio(value: unknown, total: unknown) {
    return `${Number(value ?? 0)}/${Number(total ?? 0)}`;
  }

  private percent(value: unknown, total: unknown) {
    const denominator = Number(total ?? 0);
    if (!denominator) return 0;
    return Math.min(100, Math.round((Number(value ?? 0) / denominator) * 100));
  }
}

type CyberSection =
  | 'dashboard'
  | 'servers'
  | 'profiles'
  | 'decisions'
  | 'alerts'
  | 'lists'
  | 'trusted-nodes'
  | 'network-policies'
  | 'security-events';
