import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

// The page instance downloads the CSV with the authenticated API client.
let download: ((row: ConfigurableCrudRecord) => Promise<void>) | null = null;

const monthStart = () => new Date().toISOString().slice(0, 8) + '01';
const today = () => new Date().toISOString().slice(0, 10);

const config = defineCrud({
  endpoint: 'accounting/exports',
  uuidField: 'AexUUID',
  pageTitle: 'Accounting exports',
  pageDescription:
    'Files for your accountant with every posted event of a period; each event is exported once. Events without account mapping stay out until mapped.',
  createTitle: 'New accounting export',
  createLabel: 'Export',
  savedMessage: 'Accounting export created.',
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialValues: { periodStart: monthStart(), periodEnd: today() },
  columns: [
    { id: 'id', label: 'Export', field: 'AexID', uuidField: 'AexUUID', kind: 'identity' },
    { id: 'start', label: 'Period start', field: 'AexPeriodStart', kind: 'date' },
    { id: 'end', label: 'Period end', field: 'AexPeriodEnd', kind: 'date' },
    { id: 'events', label: 'Events', field: 'AexEventCount', kind: 'number' },
    { id: 'total', label: 'Total', field: 'AexTotal', kind: 'currency' },
    { id: 'errors', label: 'Without mapping', field: 'AexErrorCount', kind: 'number' },
    { id: 'created', label: 'Created at', field: 'AexDateCreated', kind: 'datetime' },
  ],
  fields: [
    {
      key: 'periodStart',
      label: 'Period start',
      type: 'date',
      required: true,
    },
    {
      key: 'periodEnd',
      label: 'Period end',
      type: 'date',
      required: true,
      help: 'Inclusive; at most one year.',
    },
  ],
  payload: (values) => ({ periodStart: values['periodStart'], periodEnd: values['periodEnd'] }),
  rowActions: [
    {
      key: 'file',
      label: 'Download CSV',
      icon: 'download',
      run: (row) => download?.(row),
    },
  ],
});

@Component({
  selector: 'app-accounting-exports',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AccountingExportsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
    download = async (row) => {
      const blob = await this.api.getBlob(`accounting/exports/${row['AexUUID']}/file`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `accounting-${row['AexID'] || row['AexUUID']}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
}
