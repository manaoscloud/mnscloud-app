import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { FISCAL_DOCUMENT_STATES, FISCAL_ENVIRONMENTS, FISCAL_MODELS } from './fiscal-options';

// The page instance downloads the XML with the authenticated API client.
let download: ((row: ConfigurableCrudRecord) => Promise<void>) | null = null;

const config = defineCrud({
  endpoint: 'fiscal/documents',
  uuidField: 'FdoUUID',
  pageTitle: 'Fiscal documents',
  pageDescription:
    'NFC-e and NF-e of the establishments with their state at the tax authority; an unknown answer is always checked before any resend.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  listFilters: [
    {
      key: 'state',
      label: 'State',
      paramKey: 'state',
      type: 'select',
      span: 1,
      options: FISCAL_DOCUMENT_STATES,
      emptyLabel: 'All',
    },
    {
      key: 'model',
      label: 'Model',
      paramKey: 'model',
      type: 'select',
      span: 1,
      options: FISCAL_MODELS,
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'number', label: 'Number', field: 'FdoNumber', uuidField: 'FdoUUID', kind: 'identity' },
    { id: 'model', label: 'Model', field: 'FdoModel', options: FISCAL_MODELS },
    { id: 'series', label: 'Series', field: 'FdoSeries' },
    { id: 'company', label: 'Company', field: 'CompanyName' },
    { id: 'total', label: 'Total', field: 'FrqTotal', kind: 'currency' },
    { id: 'state', label: 'State', field: 'FdoState', options: FISCAL_DOCUMENT_STATES },
    { id: 'reason', label: 'Authority answer', field: 'FdoStateReason' },
    {
      id: 'environment',
      label: 'Environment',
      field: 'FdoEnvironment',
      options: FISCAL_ENVIRONMENTS,
      optional: true,
    },
    { id: 'key', label: 'Access key', field: 'FdoAccessKey', optional: true, copyable: true },
    { id: 'created', label: 'Created at', field: 'FdoDateCreated', kind: 'datetime' },
  ],
  fields: [],
  rowActions: [
    {
      key: 'process',
      label: 'Process now',
      icon: 'sync',
      visible: (row) =>
        ['prevalidating', 'generated', 'signed', 'unknown', 'rejected'].includes(
          String(row['FdoState']),
        ),
      request: {
        method: 'post',
        endpoint: (row) => `fiscal/documents/${row['FdoUUID']}/process`,
        successMessage: 'Fiscal document processed.',
      },
    },
    {
      key: 'xml',
      label: 'Download XML',
      icon: 'download',
      visible: (row) => !['prevalidating', 'generated'].includes(String(row['FdoState'])),
      run: (row) => download?.(row),
    },
    {
      key: 'history',
      label: 'History',
      icon: 'timeline',
      collection: (row) =>
        defineCrud({
          endpoint: `fiscal/documents/${row['FdoUUID']}/history`,
          uuidField: 'FdhUUID',
          pageTitle: 'Fiscal document history',
          pageDescription: 'Every state of the document with the reason, in order.',
          readOnly: true,
          statusFilter: false,
          columns: [
            { id: 'when', label: 'When', field: 'FdhDateCreated', kind: 'datetime' },
            { id: 'from', label: 'From', field: 'FdhFromState', options: FISCAL_DOCUMENT_STATES },
            { id: 'to', label: 'To', field: 'FdhToState', options: FISCAL_DOCUMENT_STATES },
            { id: 'reason', label: 'Reason', field: 'FdhReason' },
          ],
          fields: [],
        }),
    },
    {
      key: 'cancel',
      label: 'Cancel document',
      icon: 'block',
      visible: (row) => row['FdoState'] === 'authorized',
      form: (row) =>
        defineCrud({
          endpoint: `fiscal/documents/${row['FdoUUID']}/cancel`,
          uuidField: 'FdoUUID',
          pageTitle: 'Cancel fiscal document',
          pageDescription:
            'The cancellation event goes to the tax authority; it is accepted only within the deadline of the model.',
          createTitle: 'Cancel fiscal document',
          savedMessage: 'Cancellation requested.',
          statusFilter: false,
          initialValues: { reason: '' },
          columns: [],
          fields: [
            {
              key: 'reason',
              label: 'Reason',
              type: 'textarea',
              required: true,
              help: 'At least 15 characters.',
              span: 4,
              rows: 3,
            },
          ],
        }),
    },
  ],
});

@Component({
  selector: 'app-fiscal-documents',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FiscalDocumentsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
    download = async (row) => {
      const blob = await this.api.getBlob(`fiscal/documents/${row['FdoUUID']}/xml`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${row['FdoAccessKey'] || row['FdoUUID']}.xml`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
}
