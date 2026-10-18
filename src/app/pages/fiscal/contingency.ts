import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { FISCAL_DOCUMENT_STATES } from './fiscal-options';

// NFC-e signed offline by installed devices and not authorized yet; each must reach the tax
// authority before its deadline.
const config = defineCrud({
  endpoint: 'fiscal/contingency',
  uuidField: 'FdoUUID',
  pageTitle: 'Offline contingency',
  pageDescription:
    'NFC-e signed offline by the registers and still to be authorized, the nearest transmission deadline first.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  columns: [
    { id: 'number', label: 'Number', field: 'FdoNumber', uuidField: 'FdoUUID', kind: 'identity' },
    { id: 'series', label: 'Series', field: 'FdoSeries' },
    { id: 'state', label: 'State', field: 'FdoState', options: FISCAL_DOCUMENT_STATES },
    { id: 'deadline', label: 'Deadline', field: 'FdoContingencyDeadline', kind: 'datetime' },
    { id: 'overdue', label: 'Overdue', field: 'Overdue', kind: 'boolean' },
  ],
  fields: [],
  rowActions: [
    {
      key: 'process',
      label: 'Transmit now',
      icon: 'send',
      request: {
        method: 'post',
        endpoint: (row) => `fiscal/documents/${row['FdoUUID']}/process`,
        successMessage: 'Fiscal document processed.',
      },
    },
  ],
});

@Component({
  selector: 'app-fiscal-contingency',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FiscalContingencyPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
