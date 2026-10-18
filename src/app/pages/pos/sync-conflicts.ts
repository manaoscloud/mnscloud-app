import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];
const KINDS = [
  { value: 'PRICE_CHANGED', label: 'Price changed' },
  { value: 'DISCOUNT_LIMIT', label: 'Discount above the limit' },
  { value: 'STOCK_NEGATIVE', label: 'Stock went negative' },
  { value: 'SESSION_CLOSED_BEFORE_SYNC', label: 'Cash session closed before sync' },
  { value: 'SESSION_FORCE_CLOSED', label: 'Cash session closed by the device' },
  { value: 'TERMINAL_INACTIVE', label: 'Terminal inactive' },
  { value: 'GRANT_EXPIRED', label: 'Outside the offline grant' },
  { value: 'GRANT_LIMIT_EXCEEDED', label: 'Offline limit exceeded' },
  { value: 'OPERATOR_NOT_IN_GRANT', label: 'Operator outside the grant' },
  { value: 'DEVICE_COUNTER_REPLAY', label: 'Cloned or restored device' },
];
const POLICIES = [
  { value: 'accept_flag', label: 'Accepted and flagged' },
  { value: 'review', label: 'Needs review' },
];

// Effects completed offline are never discarded: each divergence found at sync becomes a
// conflict that the manager reviews and resolves.
const config = defineCrud({
  endpoint: 'pos/sync/conflicts',
  uuidField: 'ScfUUID',
  pageTitle: 'POS sync conflicts',
  pageDescription:
    'Divergences found when installed devices synchronized sales and cash; the sales stay recorded and are reviewed here.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  listFilters: [
    {
      key: 'deviceUUID',
      label: 'Device',
      paramKey: 'deviceUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'pos/devices', uuidField: 'SdvUUID', labelField: 'SdvName' },
    },
    {
      key: 'status',
      label: 'Status',
      paramKey: 'status',
      type: 'select',
      span: 1,
      options: STATUSES,
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'id', label: 'ID', field: 'ScfID', uuidField: 'ScfUUID', kind: 'identity' },
    { id: 'kind', label: 'Conflict', field: 'ScfKind', options: KINDS },
    { id: 'policy', label: 'Policy', field: 'ScfPolicy', options: POLICIES },
    { id: 'device', label: 'Device', field: 'DeviceName' },
    { id: 'sale', label: 'Sale', field: 'SaleID' },
    { id: 'status', label: 'Status', field: 'ScfStatus', options: STATUSES },
    { id: 'created', label: 'Found at', field: 'ScfDateCreated', kind: 'datetime' },
    { id: 'resolution', label: 'Resolution', field: 'ScfResolution', optional: true },
  ],
  fields: [],
  rowActions: [
    {
      key: 'resolve',
      label: 'Resolve',
      icon: 'task_alt',
      visible: (row) => row['ScfStatus'] === 'open',
      form: (row) =>
        defineCrud({
          endpoint: `pos/sync/conflicts/${row['ScfUUID']}/resolve`,
          uuidField: 'ScfUUID',
          pageTitle: 'Resolve conflict',
          pageDescription:
            'Record what was checked or adjusted. A sale with no open conflict is synchronized again.',
          createTitle: 'Resolve conflict',
          savedMessage: 'Conflict resolved.',
          statusFilter: false,
          initialValues: { resolution: '' },
          columns: [],
          fields: [{ key: 'resolution', label: 'Resolution', required: true, span: 4 }],
        }),
    },
  ],
});

@Component({
  selector: 'app-pos-sync-conflicts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class PosSyncConflictsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
