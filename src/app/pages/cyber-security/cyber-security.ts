import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../../services/api.service';
import { SnackbarService } from '../../services/snackbar.service';
import { fadeIn } from '../../shared/animations/fade.animation';

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
  sourceIP?: string;
  method?: string;
  path?: string;
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

@Component({
  selector: 'app-cyber-security',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    RouterLink,
  ],
  templateUrl: './cyber-security.html',
  styleUrls: ['./cyber-security.scss'],
  animations: [fadeIn],
})
export class CyberSecurityPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snack = inject(SnackbarService);

  @ViewChild('listDialog')
  listDialog?: TemplateRef<unknown>;
  @ViewChild('networkPolicyDialog')
  networkPolicyDialog?: TemplateRef<unknown>;
  @ViewChild('jobDialog')
  jobDialog?: TemplateRef<unknown>;

  readonly loading = signal(false);
  readonly dashboard = signal<CyberRecord>({});
  readonly servers = signal<CyberRecord[]>([]);
  readonly services = signal<CyberRecord[]>([]);
  readonly profiles = signal<CyberRecord[]>([]);
  readonly decisions = signal<CyberRecord[]>([]);
  readonly alerts = signal<CyberRecord[]>([]);
  readonly listEntries = signal<CyberRecord[]>([]);
  readonly trustedNodes = signal<CyberRecord[]>([]);
  readonly networkPolicies = signal<CyberRecord[]>([]);
  readonly securityEvents = signal<CyberRecord[]>([]);
  readonly editingListEntry = signal<CyberRecord | null>(null);
  readonly editingNetworkPolicy = signal<CyberRecord | null>(null);
  readonly serverProfileSearch = signal('');
  readonly selectedServer = signal<CyberRecord | null>(null);
  readonly selectedJobs = signal<CyberRecord[]>([]);
  readonly activeSection = signal<CyberSection>('dashboard');

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
  readonly filteredProfiles = computed(() => {
    const search = this.serverProfileSearch().trim().toLowerCase();
    if (!search) return this.profiles();
    return this.profiles().filter((profile) =>
      `${profile.name ?? ''} ${profile.description ?? ''} ${profile.serviceSlugs ?? ''}`
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
  readonly decisionColumns = ['value', 'action', 'origin', 'scenario', 'service', 'expires'];
  readonly alertColumns = ['level', 'status', 'scenario', 'service', 'source', 'message'];
  readonly listColumns = ['type', 'value', 'scope', 'reason', 'actions'];
  readonly networkPolicyColumns = [
    'name',
    'endpointGroup',
    'action',
    'mode',
    'rateLimit',
    'node',
    'actions',
  ];
  readonly securityEventColumns = [
    'detectedAt',
    'decision',
    'endpointGroup',
    'source',
    'node',
    'reason',
  ];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly listForm = this.fb.nonNullable.group({
    listType: ['allowlist', [Validators.required]],
    value: ['', [Validators.required]],
    scope: ['ip', [Validators.required]],
    reason: [''],
    enabled: [1],
  });

  readonly networkPolicyForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    endpointGroup: ['freeswitch_xml_curl', [Validators.required]],
    action: ['custom_rate_limit', [Validators.required]],
    scope: ['tenant', [Validators.required]],
    mode: ['monitor', [Validators.required]],
    priority: [100],
    nodeType: ['freeswitch', [Validators.required]],
    trustedNodeUUID: [''],
    networks: ['[]'],
    methods: ['["GET","POST"]'],
    rateLimitPerMinute: [300],
    burst: [120],
    reason: [''],
    enabled: [1],
  });

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.activeSection.set(this.normalizeSection(params.get('section')));
    });
    void this.loadAll();
  }

  routeFor(section: CyberSection) {
    const base = this.router.url.startsWith('/system/cyber-security')
      ? '/system/cyber-security'
      : '/cyber-security';
    return section === 'dashboard' ? base : `${base}/${section}`;
  }

  async loadAll() {
    this.loading.set(true);
    try {
      const query = this.queryString();
      const [
        dashboard,
        servers,
        services,
        profiles,
        decisions,
        alerts,
        lists,
        trustedNodes,
        networkPolicies,
        securityEvents,
      ] = await Promise.all([
        this.api.get<any>('cyber-security/dashboard'),
        this.api.get<any>(`cyber-security/servers${query}`),
        this.api.get<any>(`cyber-security/services${query}`),
        this.api.get<any>(`cyber-security/profiles${query}`),
        this.api.get<any>(`cyber-security/decisions${query}`),
        this.api.get<any>(`cyber-security/alerts${query}`),
        this.api.get<any>(`cyber-security/lists${query}`),
        this.api.get<any>(`cyber-security/trusted-nodes${query}`),
        this.api.get<any>(`cyber-security/network-policies${query}`),
        this.api.get<any>(`cyber-security/security-events${query}`),
      ]);
      this.dashboard.set(dashboard?.data ?? {});
      this.servers.set(servers?.data?.items ?? []);
      this.services.set(services?.data?.items ?? []);
      this.profiles.set(profiles?.data?.items ?? []);
      this.decisions.set(decisions?.data?.items ?? []);
      this.alerts.set(alerts?.data?.items ?? []);
      this.listEntries.set(lists?.data?.items ?? []);
      this.trustedNodes.set(trustedNodes?.data?.items ?? []);
      this.networkPolicies.set(networkPolicies?.data?.items ?? []);
      this.securityEvents.set(securityEvents?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load Cyber Security.'));
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters() {
    void this.loadAll();
  }

  clearFilters() {
    this.filterForm.reset({ search: '' });
    void this.loadAll();
  }

  clearServerProfileSearch(open: boolean) {
    if (!open) this.serverProfileSearch.set('');
  }

  openListEntry(row?: CyberRecord, listType = 'allowlist') {
    this.editingListEntry.set(row ?? null);
    this.listForm.reset({
      listType: row?.listType ?? listType,
      value: row?.value ?? '',
      scope: row?.scope ?? 'ip',
      reason: row?.reason ?? '',
      enabled: row?.enabled ?? 1,
    });
    this.openDialog(this.listDialog);
  }

  async saveListEntry() {
    if (this.listForm.invalid) return;
    const row = this.editingListEntry();
    await this.save(
      row ? `cyber-security/lists/${row.uuid}` : 'cyber-security/lists',
      this.listForm.getRawValue(),
      !!row,
    );
  }

  async deleteListEntry(row: CyberRecord) {
    await this.remove(`cyber-security/lists/${row.uuid}`);
  }

  openNetworkPolicy(row?: CyberRecord) {
    this.editingNetworkPolicy.set(row ?? null);
    this.networkPolicyForm.reset({
      name: row?.name ?? '',
      endpointGroup: row?.endpointGroup ?? 'freeswitch_xml_curl',
      action: row?.action ?? 'custom_rate_limit',
      scope: row?.scope ?? 'tenant',
      mode: row?.mode ?? 'monitor',
      priority: row?.priority ?? 100,
      nodeType: row?.nodeType ?? 'freeswitch',
      trustedNodeUUID: row?.trustedNodeUUID ?? '',
      networks: this.pretty(row?.networks ?? []),
      methods: this.pretty(row?.methods ?? ['GET', 'POST']),
      rateLimitPerMinute: row?.rateLimitPerMinute ?? 300,
      burst: row?.burst ?? 120,
      reason: row?.reason ?? '',
      enabled: row?.enabled ?? 1,
    });
    this.openDialog(this.networkPolicyDialog);
  }

  async saveNetworkPolicy() {
    if (this.networkPolicyForm.invalid) return;
    const row = this.editingNetworkPolicy();
    const payload = this.parseJsonFields(this.networkPolicyForm.getRawValue(), [
      'networks',
      'methods',
    ]);
    if (!payload['trustedNodeUUID']) payload['trustedNodeUUID'] = null;
    await this.save(
      row ? `cyber-security/network-policies/${row.uuid}` : 'cyber-security/network-policies',
      payload,
      !!row,
    );
  }

  async deleteNetworkPolicy(row: CyberRecord) {
    await this.remove(`cyber-security/network-policies/${row.uuid}`);
  }

  async requestStatusRefresh(row: CyberRecord) {
    if (!row.agentUUID) return;
    await this.api.post('cyber-security/servers/jobs', {
      agentUUID: row.agentUUID,
      command: 'cyber.security.status',
      payload: {},
    });
    this.snack.success('Security status refresh started.');
    void this.loadAll();
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
    void this.loadAll();
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
    void this.loadAll();
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
      void this.loadAll();
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
    this.openDialog(this.jobDialog, '1100px');
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

  private async save(endpoint: string, payload: Record<string, any>, update: boolean) {
    try {
      if (update) await this.api.put(endpoint, payload);
      else await this.api.post(endpoint, payload);
      this.dialog.closeAll();
      this.snack.success('Saved successfully.');
      void this.loadAll();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to save.'));
    }
  }

  private async remove(endpoint: string) {
    try {
      await this.api.delete(endpoint);
      this.snack.success('Deleted successfully.');
      void this.loadAll();
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

  private queryString() {
    const search = this.filterForm.getRawValue().search.trim();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
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

  private errorMessage(error: any, fallback: string) {
    return error?.error?.error || error?.message || fallback;
  }

  private normalizeSection(value: string | null): CyberSection {
    const section = value || 'dashboard';
    return this.sections.some((item) => item.key === section)
      ? (section as CyberSection)
      : 'dashboard';
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
