import { authenticationPayload, authenticationRecordFields } from '../authentication-input';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { conventionalResaleAccountRowActions } from '../../../shared/crud/configurable-crud/account-resale-actions';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'authentication/accounts',
  uuidField: 'AacUUID',
  pageTitle: 'authentication.accounts',
  pageDescription: 'authentication.accountsDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency confirmation; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['AacRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    status: 1,
    revision: 1,
    AuthenticationClusterAtcUUID: '',
    RegCustomerRcuUUID: '',
  },
  payload: (values, editing) => {
    const payload = authenticationPayload(values, editing);
    // The resale customer is set once, at creation; empty means an own-use account.
    if (editing) delete payload['RegCustomerRcuUUID'];
    else if (!payload['RegCustomerRcuUUID']) payload['RegCustomerRcuUUID'] = null;
    return payload;
  },
  fields: [
    { key: 'status', source: 'AacStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'AuthenticationClusterAtcUUID',
      source: 'AuthenticationClusterAtcUUID',
      label: 'authentication.clusters',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'authentication/clusters',
        uuidField: 'AtcUUID',
        labelField: 'AtcName',
      },
      disabledWhen: ({ editing }) => editing,
      help: 'authentication.scopeHelp',
    },
    { key: 'name', source: 'AacName', label: 'Name', required: true, span: 1 },
    {
      key: 'RegCustomerRcuUUID',
      source: 'RegCustomerRcuUUID',
      label: 'Customer',
      span: 1,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'registry/customers?status=1',
        searchParam: 'q',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
      quickCreate: quickCreateFor('RegCustomerRcuUUID'),
      disabledWhen: ({ editing }) => editing,
      help: 'authentication.accountCustomerHelp',
    },
    ...authenticationRecordFields('Aac'),
  ],
  columns: [
    { id: 'name', field: 'AacName', label: 'Name', kind: 'identity' },
    {
      id: 'cluster',
      field: 'ClusterName',
      label: 'authentication.clusters',
      kind: 'related',
      uuidField: 'AuthenticationClusterAtcUUID',
    },
    {
      id: 'customer',
      field: 'CustomerName',
      label: 'Customer',
      kind: 'related',
      uuidField: 'RegCustomerRcuUUID',
    },
    {
      id: 'publication',
      field: 'AacPortalEnabled',
      label: 'authentication.portalEnabled',
      kind: 'status',
    },
    { id: 'accesses', field: 'AccessCount', label: 'authentication.accessCount', kind: 'number' },
    { id: 'status', field: 'AacStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationAccountPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const auth = inject(AuthService);
    // Members and portal publication are account-wide administration.
    const canManage = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.authentication.accounts.all');
    super({
      ...config,
      rowActions: conventionalResaleAccountRowActions('authentication', 'Aac', 'Aam', canManage),
    });
  }
}
