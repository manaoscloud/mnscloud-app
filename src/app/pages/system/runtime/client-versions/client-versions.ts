import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

/** Product codes sent by the browser clients in `X-Mns-Client`. */
const CLIENT_LABELS: Record<string, string> = {
  'mnscloud-app': 'App',
  'mnscloud-customer-portal': 'Customer portal',
  'mnscloud-pulse': 'Pulse',
  'mnscloud-phoneweb': 'PhoneWeb',
};

const config = defineCrud({
  endpoint: 'system/runtime/client-versions',
  uuidField: 'key',
  pageTitle: 'Versions in use',
  pageDescription:
    'Sessions active in the last 15 minutes by client version, to see how many users still run an outdated App after a release.',
  createTitle: 'Versions in use',
  searchPlaceholder: 'Search',
  emptyLabel: 'No active sessions in the last 15 minutes.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  statusMode: 'string',
  activeValue: 'current',
  inactiveValue: 'outdated',
  initialValues: {},
  fields: [],
  columns: [
    {
      id: 'client',
      label: 'Client',
      value: (row, translate) => {
        const product = String(row['product'] ?? '');
        return product ? translate(CLIENT_LABELS[product] ?? product) : translate('Older client');
      },
    },
    { id: 'version', label: 'Version', field: 'version', translateValue: false },
    { id: 'sessions', label: 'Sessions', field: 'sessions', translateValue: false },
    { id: 'users', label: 'Users', field: 'users', translateValue: false },
    { id: 'lastAccessAt', label: 'Last access', kind: 'datetime', field: 'lastAccessAt' },
    {
      id: 'installedVersion',
      label: 'Installed version',
      field: 'installedVersion',
      translateValue: false,
    },
    {
      id: 'state',
      label: 'Situation',
      value: (row, translate) => {
        if (row['outdated'] === true) return translate('Outdated');
        return row['installedVersion'] ? translate('Up to date') : '-';
      },
    },
  ],
});

@Component({
  selector: 'app-system-runtime-client-versions',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemRuntimeClientVersionsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
