import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import type { HostingWebhostHost } from '../webhost.types';
import {
  WEBHOST_HOST_STATUS_OPTIONS,
  WEBHOST_PROVISION_STATUS_OPTIONS,
  appendWebhostListParams,
  asRecord,
  hostOptionLabel,
  lifecycleChipClass,
  normalizeString,
  numberOrNull,
  promptWebhostPassword,
  truthyNumber,
  webhostRootEndpoint,
} from '../webhost-shared';

const PROVISION_ACTION: ConfigurableCrudRowAction = {
  key: 'provision',
  label: 'Provision',
  icon: 'cloud_upload',
  tooltip: 'Provision',
};
const RESET_PASSWORD_ACTION: ConfigurableCrudRowAction = {
  key: 'reset-password',
  label: 'Reset password',
  icon: 'password',
  tooltip: 'Reset password',
};
const SYNC_ACTION: ConfigurableCrudRowAction = {
  key: 'sync',
  label: 'Sync',
  icon: 'sync',
  tooltip: 'Sync',
};
const SUSPEND_ACTION: ConfigurableCrudRowAction = {
  key: 'suspend',
  label: 'Suspend',
  icon: 'pause_circle',
  tooltip: 'Suspend',
};
const UNSUSPEND_ACTION: ConfigurableCrudRowAction = {
  key: 'unsuspend',
  label: 'Unsuspend',
  icon: 'play_circle',
  tooltip: 'Unsuspend',
};
const DEPROVISION_ACTION: ConfigurableCrudRowAction = {
  key: 'deprovision',
  label: 'Deprovision',
  icon: 'cloud_off',
  tooltip: 'Deprovision',
};

const EMAIL_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/webhost/emails',
  uuidField: 'HweUUID',
  pageTitle: 'Webhost Emails',
  pageDescription: 'Manage mailboxes created inside Webhost hosts.',
  createTitle: 'New webhost email',
  editTitle: 'Edit webhost email',
  dialogDescription: 'Configure mailbox identity and quota. Provision starts automatically on create.',
  searchPlaceholder: 'Email, host or domain',
  emptyLabel: 'No webhost emails found.',
  deleteTitle: 'Delete webhost email',
  deleteMessage:
    'Delete this mailbox? If it is provisioned on the provider, it will be removed there first.',
  deleteSelectedTitle: 'Delete selected webhost emails',
  deleteSelectedMessage: 'Delete {count} selected webhost emails (provider cleanup when provisioned)?',
  savedMessage: 'Webhost email saved successfully.',
  deletedMessage: 'Webhost email deleted successfully.',
  deleteFailedMessage: 'Failed to delete webhost email.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  authenticationTabAfterRecord: true,
  tabLabels: {
    authentication: 'Mailbox',
    notes: 'Notes',
  },
  rowActions: [
    PROVISION_ACTION,
    RESET_PASSWORD_ACTION,
    SYNC_ACTION,
    SUSPEND_ACTION,
    UNSUSPEND_ACTION,
    DEPROVISION_ACTION,
  ],
  listFilters: [
    {
      key: 'hostUUID',
      label: 'Host',
      paramKey: 'hostUUID',
      type: 'search-select',
      placeholder: 'Search hosts',
      emptyLabel: 'No records found.',
    },
    {
      key: 'emailStatus',
      label: 'Lifecycle',
      paramKey: 'status',
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
    },
    {
      key: 'provisionStatus',
      label: 'Provision',
      paramKey: 'provisionStatus',
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
    },
  ],
  initialValues: {
    hostUUID: '',
    localPart: '',
    password: '',
    quotaMb: 0,
    notes: '',
    status: 1,
  },
  columns: [
    { id: 'email', label: 'Email', kind: 'identity', field: 'HweEmail', uuidField: 'HweUUID' },
    {
      id: 'host',
      label: 'Host',
      kind: 'related',
      field: 'HostName',
      uuidField: 'HostingWebhostHostHwhUUID',
    },
    { id: 'provider', label: 'Provider', field: 'ProviderName' },
    { id: 'quota', label: 'Quota', field: 'EmailQuotaLabel' },
    {
      id: 'lifecycle',
      label: 'Lifecycle',
      kind: 'status',
      field: 'HweStatus',
      options: WEBHOST_HOST_STATUS_OPTIONS,
      className: 'status-col',
      chipClass: lifecycleChipClass,
    },
    {
      id: 'provision',
      label: 'Provision',
      kind: 'status',
      field: 'HweProvisionStatus',
      options: WEBHOST_PROVISION_STATUS_OPTIONS,
      className: 'status-col',
      chipClass: lifecycleChipClass,
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'HweIsActive', className: 'status-col' },
  ],
  fields: [
    {
      key: 'localPart',
      source: 'HweLocalPart',
      payloadKey: 'localPart',
      label: 'Username',
      required: true,
      span: 1,
    },
    {
      key: 'hostUUID',
      source: 'HostingWebhostHostHwhUUID',
      payloadKey: 'hostUUID',
      label: 'Host',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'password',
      payloadKey: 'password',
      label: 'Password',
      type: 'password',
      placeholder: 'Required for new mailbox provision',
      autocomplete: 'new-password',
      span: 1,
      requiredWhen: ({ editing }) => !editing,
    },
    {
      key: 'status',
      source: 'HweIsActive',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'quotaMb',
      source: 'HweQuotaMb',
      payloadKey: 'quotaMb',
      label: 'Quota (MB)',
      type: 'number',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'notes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 3,
    },
  ],
};

@Component({
  selector: 'app-hosting-webhost-emails',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingWebhostEmailsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly hosts = signal<HostingWebhostHost[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly rootEndpoint = computed(() => webhostRootEndpoint(this.isMaster()));
  private readonly endpoint = computed(() => `${this.rootEndpoint()}/emails`);
  private readonly hostOptions = computed<ConfigurableCrudOption[]>(() =>
    this.hosts()
      .filter((host) => host.HwhIsActive === 1)
      .map((host) => ({
        value: host.HwhUUID,
        label: hostOptionLabel(host as unknown as ConfigurableCrudRecord),
        description: host.ProviderName,
        searchText: `${host.HwhName} ${host.DomainName} ${host.HwhUsername} ${host.ProviderName}`,
      })),
  );

  constructor() {
    super(EMAIL_CONFIG);
    void this.fetchHosts();
  }

  protected override listEndpoint(): string {
    return this.endpoint();
  }

  protected override createEndpoint(): string {
    return this.endpoint();
  }

  protected override updateEndpoint(): string {
    return this.endpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.endpoint();
  }

  protected override bulkDeleteEndpoint(): string {
    return `${this.endpoint()}/bulk`;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'hostUUID') return this.hostOptions();
    if (key === 'emailStatus') return WEBHOST_HOST_STATUS_OPTIONS;
    if (key === 'provisionStatus') return WEBHOST_PROVISION_STATUS_OPTIONS;
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.hosts().length) await this.fetchHosts();
    const params = new URLSearchParams();
    appendWebhostListParams(params, filters, this.listFilters());
    const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
      `${this.listEndpoint()}?${params.toString()}`,
    );
    return (response?.data?.items ?? []).map((item) => ({
      ...item,
      HweConfig: asRecord(item['HweConfig']),
      EmailQuotaLabel: item['HweQuotaMb'] ? `${item['HweQuotaMb']} MB` : 'Default',
    }));
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const config = asRecord(row['HweConfig']);
    return {
      ...super.formValuesFromRecord(row),
      status: truthyNumber(row['HweIsActive']),
      quotaMb: Number(row['HweQuotaMb'] ?? 0),
      notes: String(config['notes'] ?? ''),
      password: '',
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    if (!this.editingRecord() && !String(payload['password'] ?? '').trim()) {
      this.snack.warning(this.t('Password is required when auto-provisioning a mailbox.'));
      return false;
    }
    return true;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const password = String(payload['password'] ?? '').trim();
    return {
      hostUUID: payload['hostUUID'],
      localPart: String(payload['localPart'] ?? '').trim(),
      ...(password ? { password } : {}),
      quotaMb: numberOrNull(payload['quotaMb']),
      config: {
        notes: normalizeString(payload['notes']),
      },
      isActive: truthyNumber(payload['status']) === 1,
    };
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const suspended = String(row['HweStatus'] ?? '') === 'suspended';
    return [
      PROVISION_ACTION,
      RESET_PASSWORD_ACTION,
      SYNC_ACTION,
      suspended ? UNSUSPEND_ACTION : SUSPEND_ACTION,
      DEPROVISION_ACTION,
    ];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = String(row['HweUUID'] ?? '');
    if (!uuid) return;

    if (action.key === 'deprovision') {
      const ok = await this.confirmAction(
        'Deprovision webhost email',
        `Remove "${String(row['HweEmail'] ?? '')}" from the provider? The local record will remain for history.`,
        'Deprovision',
      );
      if (!ok) return;
    }

    let body: Record<string, unknown> = {};
    if (action.key === 'provision' || action.key === 'reset-password') {
      const password = await promptWebhostPassword(
        this.dialog,
        action.key === 'reset-password' ? 'Reset mailbox password' : 'Provision mailbox',
        'Enter a password with at least 8 characters.',
      );
      if (!password) return;
      body = { password };
    }

    if (
      !['provision', 'reset-password', 'sync', 'suspend', 'unsuspend', 'deprovision'].includes(
        action.key,
      )
    ) {
      return;
    }

    this.mutating.set(true);
    try {
      const response = await this.api.post(`${this.endpoint()}/${uuid}/${action.key}`, body);
      this.trackOperation(response);
      this.refreshList();
    } catch (error) {
      this.snack.error(
        this.errorMessage(error) || this.t(`Failed to ${action.key} webhost email.`),
      );
    } finally {
      this.mutating.set(false);
    }
  }

  private async fetchHosts(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: HostingWebhostHost[] } }>(
        `${this.rootEndpoint()}/hosts?limit=500&offset=0&isActive=1`,
      );
      this.hosts.set(response?.data?.items ?? []);
    } catch (error) {
      this.hosts.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load webhost hosts.'));
    }
  }
}
