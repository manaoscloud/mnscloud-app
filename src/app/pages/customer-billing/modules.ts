import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'customer-billing/modules',
  uuidField: 'BsmCode',
  pageTitle: 'Billable modules',
  pageDescription:
    'Modules whose resources can be billed in contracts. A new module becomes billable by registering itself, reporting usage and applying the lifecycle events.',
  readOnly: true,
  statusFilter: false,
  columns: [
    { id: 'code', label: 'Code', field: 'BsmCode', uuidField: 'BsmCode', kind: 'identity' },
    { id: 'name', label: 'Name', field: 'BsmName' },
    { id: 'resource', label: 'Billed resource', field: 'BsmResourceLabel' },
    { id: 'entitlement', label: 'Entitlement', field: 'BsmEntitlementCode', optional: true },
    { id: 'version', label: 'Contract version', field: 'BsmContractVersion', kind: 'number' },
    { id: 'status', label: 'Status', field: 'BsmStatus', kind: 'status' },
  ],
  fields: [],
});

@Component({
  selector: 'app-customer-billing-modules',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CustomerBillingModulesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
