import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { USAGE_STATUSES } from './billing-options';

const config = defineCrud({
  endpoint: 'customer-billing/usage',
  uuidField: 'BusUUID',
  pageTitle: 'Billing usage',
  pageDescription:
    'Usage reported by the modules (minutes, traffic, storage...). Pending usage is billed on the next charge above the included quantity; unmatched usage has no usage item for its resource and metric.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  listFilters: [
    {
      key: 'status',
      label: 'Status',
      paramKey: 'status',
      type: 'select',
      span: 1,
      options: USAGE_STATUSES,
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'when', label: 'Occurred at', field: 'BusOccurredAt', kind: 'datetime' },
    { id: 'module', label: 'Source module', field: 'BillSourceModuleBsmCode' },
    { id: 'resource', label: 'Resource', field: 'BusSourceResourceUUID', copyable: true },
    { id: 'metric', label: 'Metric', field: 'BusMetric' },
    { id: 'quantity', label: 'Quantity', field: 'BusQuantity', kind: 'number' },
    { id: 'status', label: 'Status', field: 'BusStatus', options: USAGE_STATUSES },
    { id: 'key', label: 'Idempotency key', field: 'BusIdempotencyKey', optional: true },
  ],
  fields: [],
});

@Component({
  selector: 'app-customer-billing-usage',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CustomerBillingUsagePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
