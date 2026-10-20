import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'hosting/storage/accounts',
  uuidField: 'HsaUUID',
  pageTitle: 'Storage Accounts',
  pageDescription: 'Group customer buckets in commercial storage accounts.',
  dialogDescription: 'Set the account name, customer and status.',
  createTitle: 'New storage account',
  editTitle: 'Edit storage account',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusFilter: true,
  bulkDelete: true,
  initialValues: { name: '', customerUuid: '', status: 1 },
  fields: [
    { key: 'status', source: 'HsaIsActive', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'HsaName', label: 'Name', required: true, span: 1 },
    {
      key: 'customerUuid',
      source: 'CustomerCusUUID',
      label: 'Customer',
      type: 'search-select',
      span: 1,
      remoteLookup: {
        endpoint: 'erp/customers?status=1',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
    },
  ],
  columns: [
    { id: 'name', field: 'HsaName', uuidField: 'HsaUUID', label: 'Name', kind: 'identity' },
    { id: 'status', field: 'HsaIsActive', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-hosting-storage-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingStorageAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(
      (() => {
        const master = inject(ActivatedRoute).snapshot.data['scope'] === 'master';
        return {
          ...config,
          endpoint: master ? 'system/hosting/storage/accounts' : config.endpoint,
          fields: config.fields.filter((field) => !master || field.key !== 'customerUuid'),
        };
      })(),
    );
  }
  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
      customerUuid: payload['customerUuid'] || null,
      isActive: Number(payload['status']) === 1,
    };
  }
}
