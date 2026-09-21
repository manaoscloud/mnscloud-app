import { Component, computed, effect, inject, resource } from '@angular/core';
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
import {
  webhostRootEndpoint,
  WEBHOST_TOOL_STATUS_OPTIONS,
  lifecycleChipClass,
} from '../webhost-shared';

type Kind = 'databases' | 'database-users' | 'database-grants';
const retry: ConfigurableCrudRowAction = {
  key: 'provision',
  label: 'Retry provisioning',
  icon: 'cloud_upload',
};
const sync: ConfigurableCrudRowAction = { key: 'sync', label: 'Sync', icon: 'sync' };
const reset: ConfigurableCrudRowAction = {
  key: 'reset-password',
  label: 'Reset password',
  icon: 'password',
};
function configuration(kind: Kind): ConfigurableCrudConfig {
  const grant = kind === 'database-grants',
    user = kind === 'database-users';
  const title = grant ? 'Database grants' : user ? 'Database users' : 'Webhost Databases';
  return {
    endpoint: `hosting/webhost/${kind}`,
    uuidField: 'uuid',
    pageTitle: title,
    pageDescription: 'Manage database resources and access on your hosting account.',
    createTitle: grant
      ? 'Link user to database'
      : user
        ? 'New database user'
        : 'New webhost database',
    editTitle: grant
      ? 'Edit database privileges'
      : user
        ? 'Edit database user'
        : 'Edit webhost database',
    dialogDescription: 'Changes are applied automatically to the hosting provider.',
    searchPlaceholder: 'Name or host',
    emptyLabel: 'No records found.',
    deleteTitle: grant ? 'Unlink database user' : 'Delete database resource',
    deleteMessage: grant
      ? 'Revoke this user’s access to this database?'
      : 'Permanently remove this resource from the hosting provider? Unlink users first.',
    deleteSelectedTitle: 'Delete database resource',
    deleteSelectedMessage: 'Delete selected database resources?',
    savedMessage: 'Database resource saved.',
    deletedMessage: 'Database resource deleted.',
    deleteFailedMessage: 'Database operation failed.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusFilter: true,
    bulkDelete: false,
    rowActions: [retry, sync, ...(user ? [reset] : [])],
    initialValues: {
      hostUUID: '',
      name: '',
      databaseUUID: '',
      userUUID: '',
      privileges: [],
      password: '',
      notes: '',
      status: 1,
    },
    listFilters: [
      {
        key: 'hostUUID',
        label: 'Host',
        paramKey: 'hostUUID',
        type: 'search-select',
        placeholder: 'Search hosts',
        emptyLabel: 'No records found.',
      },
    ],
    columns: [
      {
        id: 'situation',
        label: 'Situation',
        kind: 'status',
        field: 'status',
        options: WEBHOST_TOOL_STATUS_OPTIONS,
        className: 'status-col',
        chipClass: lifecycleChipClass,
      },
      {
        id: 'name',
        label: grant ? 'Database' : user ? 'Username' : 'Database',
        field: 'name',
        kind: 'identity',
        uuidField: 'uuid',
      },
      {
        id: 'host',
        label: 'Host',
        field: 'HostName',
        kind: 'related',
        uuidField: 'HostingWebhostHostHwhUUID',
      },
      ...(grant ? [{ id: 'username', label: 'DB user', field: 'Username' }] : []),
      { id: 'provider', label: 'Provider', field: 'ProviderName' },
      { id: 'status', label: 'Status', kind: 'status', field: 'isActive', className: 'status-col' },
    ],
    fields: [
      {
        key: 'status',
        source: 'isActive',
        label: 'Status',
        type: 'status',
        span: 1,
        hiddenWhen: (c) => !!c.values['passwordAction'],
      },
      {
        key: 'hostUUID',
        source: 'HostingWebhostHostHwhUUID',
        label: 'Host',
        type: 'search-select',
        required: true,
        span: 1,
        disabledWhen: (c) => c.editing,
      },
      ...(grant
        ? [
            {
              key: 'databaseUUID',
              source: 'databaseUUID',
              label: 'Database',
              type: 'search-select' as const,
              required: true,
              span: 1 as const,
              disabledWhen: (c: any) => c.editing,
            },
            {
              key: 'userUUID',
              source: 'userUUID',
              label: 'DB user',
              type: 'search-select' as const,
              required: true,
              span: 1 as const,
              disabledWhen: (c: any) => c.editing,
            },
            {
              key: 'privileges',
              source: 'privileges',
              label: 'Privileges',
              type: 'checkbox-group' as const,
              required: true,
              span: 4 as const,
            },
          ]
        : [
            {
              key: 'name',
              source: 'name',
              label: user ? 'Username' : 'Database name',
              required: true,
              span: 1 as const,
              disabledWhen: (c: any) => c.editing,
            },
          ]),
      ...(user
        ? [
            {
              key: 'password',
              label: 'Password',
              type: 'password' as const,
              span: 1 as const,
              autocomplete: 'new-password',
              hiddenWhen: (c: any) => c.editing && !c.values['passwordAction'],
              requiredWhen: (c: any) => !c.editing || !!c.values['passwordAction'],
            },
          ]
        : []),
      {
        key: 'notes',
        label: 'Notes',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 3,
        hiddenWhen: (c) => !!c.values['passwordAction'],
      },
    ],
  };
}
@Component({
  selector: 'app-hosting-webhost-databases',
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingWebhostDatabasesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  override readonly dialogTitle = computed(() => {
    const action = this.formValues()['passwordAction'];
    return action === 'reset-password'
      ? 'Reset password'
      : action === 'provision'
        ? 'Retry provisioning'
        : this.editingRecord()
          ? this.config.editTitle
          : this.config.createTitle;
  });
  private readonly route = inject(ActivatedRoute);
  private readonly kind: Kind = this.route.snapshot.data['databaseResource'] ?? 'databases';
  private readonly root = webhostRootEndpoint(this.route.snapshot.data['scope'] === 'master');
  private readonly hostResource = resource({
    defaultValue: [] as ConfigurableCrudRecord[],
    loader: async () => {
      const response = await this.api.get<any>(`${this.root}/hosts?limit=1000&offset=0&isActive=1`);
      return response.data.items.filter(
        (h: ConfigurableCrudRecord) => h['HwhProvisionStatus'] === 'provisioned',
      ) as ConfigurableCrudRecord[];
    },
  });
  private readonly hostAccessResource = resource({
    params: () =>
      this.kind === 'database-grants' && this.formValues()['hostUUID']
        ? String(this.formValues()['hostUUID'])
        : undefined,
    defaultValue: {
      databases: [] as ConfigurableCrudRecord[],
      users: [] as ConfigurableCrudRecord[],
      privileges: [] as string[],
    },
    loader: async ({ params: host }) => {
      const [databases, users, capabilities] = await Promise.all([
        this.api.get<any>(`${this.root}/databases?hostUUID=${host}&limit=1000`),
        this.api.get<any>(`${this.root}/database-users?hostUUID=${host}&limit=1000`),
        this.api.get<any>(`${this.root}/database-grants/capabilities?hostUUID=${host}`),
      ]);
      const ready = (row: ConfigurableCrudRecord) => row['provisionStatus'] === 'provisioned';
      return {
        databases: databases.data.items.filter(ready) as ConfigurableCrudRecord[],
        users: users.data.items.filter(ready) as ConfigurableCrudRecord[],
        privileges: capabilities.data.privileges as string[],
      };
    },
  });
  private readonly hosts = computed(() => this.hostResource.value());
  private readonly databases = computed(() => this.hostAccessResource.value().databases);
  private readonly users = computed(() => this.hostAccessResource.value().users);
  private readonly privileges = computed(() =>
    this.hostAccessResource.value().privileges.map((p) => ({ value: p, label: p })),
  );
  constructor() {
    super(configuration(inject(ActivatedRoute).snapshot.data['databaseResource'] ?? 'databases'));
    effect(() => {
      const error = this.hostResource.error() ?? this.hostAccessResource.error();
      if (error) this.snack.error(this.errorMessage(error));
    });
    effect(() => {
      const privileges = this.hostAccessResource.value().privileges;
      if (privileges.length && this.fieldValueArray('privileges').includes('ALL PRIVILEGES')) {
        this.setFieldValue('privileges', privileges);
      }
    });
  }
  protected override listEndpoint() {
    return `${this.root}/${this.kind}`;
  }
  protected override createEndpoint() {
    return this.listEndpoint();
  }
  protected override updateEndpoint() {
    return this.listEndpoint();
  }
  protected override deleteEndpointFor() {
    return this.listEndpoint();
  }
  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'privileges') return this.privileges();
    const rows =
      key === 'hostUUID' ? this.hosts() : key === 'databaseUUID' ? this.databases() : this.users();
    return rows.map((r) => ({
      value: String(r['uuid'] ?? r['HwhUUID']),
      label: String(r['name'] ?? r['HwhName']),
    }));
  }
  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    const p = new URLSearchParams({ limit: '1000', offset: '0' });
    if (filters.search) p.set('search', String(filters.search));
    if (filters.status !== '' && filters.status != null) p.set('isActive', String(filters.status));
    const host = filters.extra?.['hostUUID'];
    if (host) p.set('hostUUID', String(host));
    const response = await this.api.get<any>(`${this.listEndpoint()}?${p}`);
    return response.data.items;
  }
  protected override formValuesFromRecord(row: ConfigurableCrudRecord) {
    return {
      ...super.formValuesFromRecord(row),
      notes: (row['config'] as any)?.notes ?? '',
      password: '',
      passwordAction: '',
    };
  }
  protected override augmentPayload(p: ConfigurableCrudRecord) {
    return {
      hostUUID: p['hostUUID'],
      ...(this.kind === 'database-grants'
        ? { databaseUUID: p['databaseUUID'], userUUID: p['userUUID'], privileges: p['privileges'] }
        : { name: p['name'] }),
      ...(!this.editingRecord() && this.kind === 'database-users'
        ? { password: p['password'] }
        : {}),
      isActive: Number(p['status']) === 1,
      config: { notes: p['notes'] || null },
    };
  }
  protected override onFieldValueChanged(key: string, value: unknown) {
    if (key === 'hostUUID') {
      this.setFieldValue('databaseUUID', '');
      this.setFieldValue('userUUID', '');
      this.setFieldValue('privileges', []);
    }
  }
  override rowActions(row: ConfigurableCrudRecord) {
    if (['pending', 'provisioning'].includes(String(row['provisionStatus']))) return [];
    return [
      sync,
      ...(row['provisionStatus'] === 'failed' ? [retry] : []),
      ...(this.kind === 'database-users' && row['provisionStatus'] === 'provisioned'
        ? [reset]
        : []),
    ];
  }
  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (this.kind === 'database-users' && ['reset-password', 'provision'].includes(action.key)) {
      this.startEdit(row);
      this.setFieldValue('passwordAction', action.key);
      return;
    }
    this.mutating.set(true);
    try {
      this.trackOperation(
        await this.api.post(`${this.listEndpoint()}/${row['uuid']}/${action.key}`, {}),
      );
      this.refreshList();
    } catch (e) {
      this.snack.error(this.errorMessage(e));
    } finally {
      this.mutating.set(false);
    }
  }
  override async saveItem(saveAndNew = false) {
    const action = this.formValues()['passwordAction'];
    if (!action) return super.saveItem(saveAndNew);
    const p = this.formValues()['password'];
    if (typeof p !== 'string' || p.length < 12) {
      this.snack.error(this.t('Password must have at least 12 characters.'));
      return;
    }
    this.saving.set(true);
    try {
      this.trackOperation(
        await this.api.post(`${this.listEndpoint()}/${this.editingRecord()?.['uuid']}/${action}`, {
          password: p,
        }),
      );
      this.closeDialog();
      this.refreshList();
    } catch (e) {
      this.snack.error(this.errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
