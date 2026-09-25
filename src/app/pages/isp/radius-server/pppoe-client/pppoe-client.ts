import { Component, inject, resource } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'isp/radius-servers/pppoe-clients',
  uuidField: 'PpcUUID',
  pageTitle: 'PPPoE Client',
  pageDescription: 'Manage PPPoE users authenticated by RADIUS.',
  bulkDelete: true,
  initialValues: { status: 1, username: '', password: '', planName: '', fixedIpv4UUID: '' },
  columns: [
    {
      id: 'username',
      label: 'Username',
      field: 'PpcUsername',
      uuidField: 'PpcUUID',
      kind: 'identity',
    },
    { id: 'plan', label: 'Plan', field: 'PpcPlanName' },
    { id: 'ip', label: 'Fixed IPv4 (/32)', field: 'If4Cidr', translateValue: false },
    { id: 'status', label: 'Status', field: 'PpcStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'PpcStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'username', source: 'PpcUsername', label: 'Username', required: true, span: 1 },
    { key: 'password', label: 'Password', type: 'password', required: true, span: 1 },
    { key: 'planName', source: 'PpcPlanName', label: 'Plan', span: 1 },
    {
      key: 'fixedIpv4UUID',
      source: 'If4UUID',
      label: 'Fixed IPv4 (/32)',
      type: 'search-select',
      quickCreate: false,
      quickCreateExemptReason:
        'Only /32 fixed IPv4 entries are assignable; create them in Fixed IPv4.',
      span: 1,
    },
  ],
});

@Component({
  selector: 'app-pppoe-client',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class PppoeClientPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly lookupApi = inject(ApiService);

  // PPPoE clients may only receive single-host (/32) fixed IPv4 assignments.
  private readonly fixedIpv4 = resource({
    defaultValue: [] as ConfigurableCrudOption[],
    loader: async (): Promise<ConfigurableCrudOption[]> => {
      const response = await this.lookupApi.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
        'isp/fixed-ipv4-addresses?status=1&limit=1000&offset=0',
      );
      return (response?.data?.items ?? [])
        .filter((item) => String(item['If4Cidr'] ?? '').endsWith('/32'))
        .map((item): ConfigurableCrudOption => ({
          value: String(item['If4UUID']),
          label: `${item['If4Name']} (${item['If4Cidr']})`,
        }));
    },
  });

  constructor() {
    super(config);
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'fixedIpv4UUID' ? this.fixedIpv4.isLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'fixedIpv4UUID' ? this.fixedIpv4.value() : [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      fixedIpv4UUID: payload['fixedIpv4UUID'] || null,
      planName: payload['planName'] || null,
      status: Number(payload['status']),
    };
  }
}
