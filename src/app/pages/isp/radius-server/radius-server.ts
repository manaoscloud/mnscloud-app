import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const yesNo = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

// Route data `scope: 'master'` manages the platform RADIUS catalog; tenants manage their own.
function radiusServers(scope: string) {
  const master = scope === 'master';
  return defineCrud({
    endpoint: master ? 'system/isp/radius-servers' : 'isp/radius-servers',
    uuidField: 'IrsUUID',
    pageTitle: 'Radius Server',
    pageDescription: master
      ? 'Platform RADIUS servers available to tenants.'
      : 'RADIUS servers used to authenticate your PPPoE clients.',
    bulkDelete: true,
    initialValues: {
      status: 1,
      isDefault: 0,
      name: '',
      host: '',
      authPort: 1812,
      acctPort: 1813,
      secret: '',
      notes: '',
    },
    columns: [
      { id: 'name', label: 'Name', field: 'IrsName', uuidField: 'IrsUUID', kind: 'identity' },
      { id: 'host', label: 'Host', field: 'IrsHost', translateValue: false },
      { id: 'authPort', label: 'Auth Port', field: 'IrsAuthPort', kind: 'number' },
      { id: 'acctPort', label: 'Acct Port', field: 'IrsAcctPort', kind: 'number' },
      { id: 'default', label: 'Default', field: 'IrsIsDefault', kind: 'boolean' },
      { id: 'status', label: 'Status', field: 'IrsStatus', kind: 'status' },
    ],
    fields: [
      { key: 'status', source: 'IrsStatus', label: 'Status', type: 'status', span: 1 },
      {
        key: 'isDefault',
        source: 'IrsIsDefault',
        label: 'Default',
        type: 'select',
        options: yesNo,
        span: 1,
      },
      { key: 'name', source: 'IrsName', label: 'Name', required: true, span: 1 },
      { key: 'host', source: 'IrsHost', label: 'Host', required: true, span: 1 },
      {
        key: 'authPort',
        source: 'IrsAuthPort',
        label: 'Auth Port',
        type: 'number',
        required: true,
        span: 1,
      },
      {
        key: 'acctPort',
        source: 'IrsAcctPort',
        label: 'Acct Port',
        type: 'number',
        required: true,
        span: 1,
      },
      {
        key: 'secret',
        label: 'Secret',
        type: 'password',
        tab: 'authentication',
        requiredWhen: ({ editing }) => !editing,
        placeholder: 'Leave blank to keep the current secret',
        span: 2,
      },
      {
        key: 'notes',
        source: 'IrsNotes',
        label: 'Notes',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
  });
}

@Component({
  selector: 'app-isp-radius-server',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspRadiusServerPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(radiusServers(inject(ActivatedRoute).snapshot.data['scope'] ?? 'tenant'));
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const { secret, ...rest } = payload;
    const value = typeof secret === 'string' ? secret.trim() : '';
    return {
      ...rest,
      ...(value ? { secret: value } : {}),
      authPort: Number(payload['authPort']),
      acctPort: Number(payload['acctPort']),
      isDefault: Number(payload['isDefault']) ? 1 : 0,
      status: Number(payload['status']),
    };
  }
}
