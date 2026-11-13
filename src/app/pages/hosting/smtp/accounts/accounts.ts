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
import { openInstallCommandDialog } from '../../../../shared/install-command-dialog/open-install-command-dialog';
import {
  SMTP_RESALE_LINK_KEY,
  SMTP_RESALE_SEND_KEY_GENERATE_KEY,
  smtpResaleActions,
  smtpResaleBody,
  smtpResaleChanged,
  smtpSendKeyFromResponse,
  smtpSendKeyLabel,
} from './resale-actions';

type HostingSmtpProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: string;
};

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const VALIDATE_ACTION: ConfigurableCrudRowAction = {
  key: 'validate',
  label: 'Validate',
  icon: 'fact_check',
  tooltip: 'Validate',
};

const ACCOUNT_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/smtp/accounts',
  uuidField: 'HsaUUID',
  pageTitle: 'SMTP Accounts',
  pageDescription: 'Manage sender accounts linked to SMTP providers.',
  createTitle: 'New SMTP account',
  editTitle: 'Edit SMTP account',
  dialogDescription: 'Configure SMTP account identity, provider and sender defaults.',
  searchPlaceholder: 'Name, provider or sender',
  emptyLabel: 'No SMTP accounts found.',
  deleteTitle: 'Delete SMTP account',
  deleteMessage: 'Are you sure you want to delete this SMTP account?',
  deleteSelectedTitle: 'Delete selected SMTP accounts',
  deleteSelectedMessage: 'Delete {count} selected SMTP accounts?',
  savedMessage: 'SMTP account saved successfully.',
  deletedMessage: 'SMTP account deleted successfully.',
  deleteFailedMessage: 'Failed to delete SMTP account.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  rowActions: [VALIDATE_ACTION],
  listFilters: [
    {
      key: 'providerUuid',
      label: 'Provider',
      paramKey: 'providerUuid',
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
    },
  ],
  tabLabels: {
    authentication: 'Sender',
  },
  initialValues: {
    name: '',
    providerUuid: '',
    status: 1,
    isDefault: 0,
    defaultFromName: '',
    defaultFromEmail: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HsaName', uuidField: 'HsaUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'HspName',
      uuidField: 'HostingSmtpProviderHspUUID',
    },
    { id: 'from', label: 'From', field: 'HsaDefaultFromEmail' },
    {
      id: 'default',
      label: 'Default',
      kind: 'boolean',
      field: 'HsaIsDefault',
      className: 'status-col',
    },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'HsaIsActive',
      className: 'status-col',
    },
    { id: 'customer', label: 'hostingSmtp.resale.customerColumn', field: 'CustomerName' },
    {
      id: 'portal',
      label: 'hostingSmtp.resale.portalColumn',
      value: (item, translate) =>
        translate(
          Number(item['HsaPortalEnabled'] ?? 0) === 1
            ? 'hostingSmtp.resale.portalYes'
            : 'hostingSmtp.resale.portalNo',
        ),
    },
    { id: 'dailyLimit', label: 'hostingSmtp.resale.dailyLimitColumn', field: 'HsaDailyLimit' },
    {
      id: 'sendKey',
      label: 'hostingSmtp.resale.keyColumn',
      value: (item) => smtpSendKeyLabel(item),
    },
  ],
  fields: [
    {
      key: 'status',
      source: 'HsaIsActive',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'providerUuid',
      source: 'HostingSmtpProviderHspUUID',
      payloadKey: 'providerUuid',
      label: 'Provider',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'HsaIsDefault',
      payloadKey: 'isDefault',
      label: 'Default account',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'HsaName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'defaultFromName',
      source: 'HsaDefaultFromName',
      payloadKey: 'defaultFromName',
      label: 'Default from name',
      tab: 'authentication',
    },
    {
      key: 'defaultFromEmail',
      source: 'HsaDefaultFromEmail',
      payloadKey: 'defaultFromEmail',
      label: 'Default from email',
      type: 'email',
      tab: 'authentication',
    },
    {
      key: 'customerUuid',
      source: 'RegCustomerRcuUUID',
      label: 'hostingSmtp.resale.customer',
      type: 'search-select',
      span: 1,
      help: 'hostingSmtp.resale.customerHelp',
      hiddenWhen: ({ editing }) => !editing,
      remoteLookup: {
        endpoint: 'registry/customers?status=1',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
    },
    {
      key: 'dailyLimit',
      source: 'HsaDailyLimit',
      label: 'hostingSmtp.resale.dailyLimit',
      type: 'number',
      positive: true,
      span: 1,
      help: 'hostingSmtp.resale.dailyLimitHelp',
      hiddenWhen: ({ editing }) => !editing,
      requiredWhen: ({ editing }) => editing,
    },
  ],
};

const RESALE_FIELD_KEYS = ['customerUuid', 'dailyLimit'];
const RESALE_COLUMN_IDS = ['customer', 'portal', 'dailyLimit', 'sendKey'];

@Component({
  selector: 'app-hosting-smtp-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingSmtpAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly providers = signal<HostingSmtpProvider[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly platformScope = computed(() => this.scope() === 'master');
  private readonly rootEndpoint = computed(() =>
    this.platformScope() ? 'system/hosting/smtp' : 'hosting/smtp',
  );
  private readonly endpoint = computed(() => `${this.rootEndpoint()}/accounts`);
  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers().map((provider) => ({
      value: provider.HspUUID,
      label: provider.HspName,
      description: provider.HspProvider,
      searchText: `${provider.HspName} ${provider.HspProvider} ${provider.HspUUID}`,
    })),
  );

  constructor() {
    super(
      (() => {
        const master = inject(ActivatedRoute).snapshot.data?.['scope'] === 'master';
        return {
          ...ACCOUNT_CONFIG,
          rowActions: [VALIDATE_ACTION, ...smtpResaleActions(master)],
          fields: ACCOUNT_CONFIG.fields.filter(
            (field) => !master || !RESALE_FIELD_KEYS.includes(field.key),
          ),
          columns: ACCOUNT_CONFIG.columns.filter(
            (column) => !master || !RESALE_COLUMN_IDS.includes(column.id),
          ),
        };
      })(),
    );
    void this.fetchProviders();
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.providers().length) await this.fetchProviders();
    return super.fetchItems(filters);
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
    if (key === 'providerUuid') return this.providerOptions();
    return [];
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const validate = String(row['HspProvider'] ?? '') === 'smtp' ? [VALIDATE_ACTION] : [];
    return [...validate, ...smtpResaleActions(this.platformScope())];
  }

  /** Customer and daily limit have their own route: send it before the account update. */
  override async saveItem(saveAndNew = false): Promise<void> {
    const current = this.editingRecord();
    if (current && !this.platformScope()) {
      const values = this.formValues();
      const dailyLimit = Number(values['dailyLimit']);
      if (Number.isInteger(dailyLimit) && dailyLimit >= 1 && smtpResaleChanged(current, values)) {
        try {
          await this.api.put(
            `${this.endpoint()}/${current['HsaUUID']}/resale`,
            smtpResaleBody(values),
          );
        } catch (error) {
          this.snack.error(this.resaleErrorMessage(error));
          return;
        }
        this.itemsResource.reload();
      }
    }
    await super.saveItem(saveAndNew);
  }

  private resaleErrorMessage(error: unknown): string {
    const code = (error as { error?: { code?: string } } | null)?.error?.code;
    if (code === 'SMTP_ACCOUNT_CONTRACT_OPEN') return this.t('hostingSmtp.resale.contractOpen');
    return this.t(this.errorMessage(error));
  }

  private async generateSendKey(row: ConfigurableCrudRecord): Promise<void> {
    const confirmed = await this.confirmAction(
      'hostingSmtp.resale.keyGenerate',
      'hostingSmtp.resale.keyGenerateConfirm',
      'hostingSmtp.resale.keyGenerate',
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      const response = await this.api.post(`${this.endpoint()}/${row['HsaUUID']}/send-key`, {});
      let sendKey = smtpSendKeyFromResponse(response);
      if (!sendKey) throw new Error('Operation failed.');
      this.itemsResource.reload();
      openInstallCommandDialog(
        this.dialog,
        {
          title: 'hostingSmtp.resale.keyDialogTitle',
          description: 'hostingSmtp.resale.keyDialogDescription',
          warning: 'hostingSmtp.resale.keyDialogWarning',
          command: sendKey,
        },
        this.destroyRef,
        () => {
          sendKey = '';
        },
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.mutating.set(false);
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
      providerUuid: payload['providerUuid'],
      defaultFromName: payload['defaultFromName'],
      defaultFromEmail: payload['defaultFromEmail'],
      isActive: truthyNumber(payload['status']) === 1,
      isDefault: truthyNumber(payload['isDefault']) === 1,
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === SMTP_RESALE_LINK_KEY) {
      this.startEdit(row);
      return;
    }
    if (action.key === SMTP_RESALE_SEND_KEY_GENERATE_KEY) {
      await this.generateSendKey(row);
      return;
    }
    if (action.key !== 'validate') return;
    const uuid = String(row['HsaUUID'] ?? '');
    if (!uuid) return;
    this.mutating.set(true);
    try {
      await this.api.post(`${this.endpoint()}/${uuid}/validate`, {});
      this.snack.success(this.t('SMTP account validated.'));
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to validate SMTP account.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private async fetchProviders(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: HostingSmtpProvider[] } }>(
        `${this.rootEndpoint()}/providers?limit=500&offset=0`,
      );
      this.providers.set(response?.data?.items ?? []);
    } catch (error) {
      this.providers.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load SMTP providers.'));
    }
  }
}

function truthyNumber(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}
