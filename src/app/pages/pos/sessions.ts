import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

// Cash sessions are opened and closed at the POS; management reads them (and their sales).
const config = defineCrud({
  endpoint: 'pos/sessions',
  uuidField: 'PcsUUID',
  pageTitle: 'Cash sessions',
  pageDescription: 'Opening, sales, expected and counted cash of each register shift of the point of sale.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  listFilters: [
    {
      key: 'terminalUUID',
      label: 'Terminal',
      paramKey: 'terminalUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'pos/terminals', uuidField: 'PtmUUID', labelField: 'PtmName' },
    },
    { key: 'status', label: 'Status', paramKey: 'status', type: 'select', span: 1, options: STATUSES, emptyLabel: 'All' },
  ],
  columns: [
    { id: 'id', label: 'ID', field: 'PcsID', uuidField: 'PcsUUID', kind: 'identity' },
    { id: 'terminal', label: 'Terminal', field: 'TerminalName' },
    { id: 'operator', label: 'Operator', field: 'OperatorName' },
    { id: 'status', label: 'Status', field: 'PcsStatus', options: STATUSES },
    { id: 'opened', label: 'Opened at', field: 'PcsOpenedAt', kind: 'datetime' },
    { id: 'closed', label: 'Closed at', field: 'PcsClosedAt', kind: 'datetime' },
    { id: 'sales', label: 'Sales', field: 'SaleCount', kind: 'number' },
    { id: 'total', label: 'Total', field: 'SaleTotal', kind: 'currency' },
    { id: 'expected', label: 'Expected cash', field: 'PcsExpectedCash', kind: 'currency' },
    { id: 'counted', label: 'Counted cash', field: 'PcsCountedCash', kind: 'currency' },
    { id: 'difference', label: 'Difference', field: 'CashDifference', kind: 'currency' },
  ],
  fields: [],
});

@Component({
  selector: 'app-pos-sessions',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class PosSessionsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
