import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { EVENT_STATUSES, LIFECYCLE_EVENTS } from './billing-options';

const config = defineCrud({
  endpoint: 'customer-billing/events',
  uuidField: 'BleUUID',
  pageTitle: 'Billing events',
  pageDescription:
    'Suspend, reactivate and cancel requests sent to the module of each contract item; the module acknowledges each one after applying it.',
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
      options: EVENT_STATUSES,
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'when', label: 'Created at', field: 'BleDateCreated', kind: 'datetime' },
    { id: 'event', label: 'Event', field: 'BleEvent', options: LIFECYCLE_EVENTS },
    { id: 'module', label: 'Source module', field: 'BillSourceModuleBsmCode' },
    { id: 'resource', label: 'Resource', field: 'BleSourceResourceUUID', copyable: true },
    { id: 'status', label: 'Status', field: 'BleStatus', options: EVENT_STATUSES },
    { id: 'ack', label: 'Acknowledged at', field: 'BleAcknowledgedAt', kind: 'datetime' },
  ],
  fields: [],
  rowActions: [
    {
      key: 'ack',
      label: 'Mark as applied',
      icon: 'done',
      visible: (row) => row['BleStatus'] === 'pending',
      request: {
        method: 'post',
        endpoint: (row) => `customer-billing/events/${row['BleUUID']}/ack`,
        successMessage: 'Event acknowledged.',
      },
    },
  ],
});

@Component({
  selector: 'app-customer-billing-events',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CustomerBillingEventsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
