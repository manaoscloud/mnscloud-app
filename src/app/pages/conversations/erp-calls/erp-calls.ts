import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { logSelectFilter, READ_ONLY_LOG_CRUD } from '../../settings/platform-provider-crud';

export const ERP_CALL_OUTCOMES = [
  { value: 'success', label: 'Success' },
  { value: 'not_found', label: 'Not found' },
  { value: 'refused', label: 'Refused' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'error', label: 'Error' },
];

/** Read-only audit of every ERP tool call of the tenant (no payloads are stored). */
const config = defineCrud({
  endpoint: 'conversations/erp/calls',
  uuidField: 'CelUUID',
  pageTitle: 'ERP calls',
  pageDescription:
    'Audit of every call the flows and the AI agent made to your ERP: tool, result, time and ERP reference. Customer data is never stored here.',
  searchPlaceholder: 'Tool, customer or reference',
  emptyLabel: 'No ERP calls recorded.',
  ...READ_ONLY_LOG_CRUD,
  listFilters: [
    {
      key: 'connectionUUID',
      paramKey: 'connectionUUID',
      label: 'ERP integration',
      type: 'search-select',
      span: 1,
      remoteLookup: {
        endpoint: 'conversations/erp/connections',
        uuidField: 'CecUUID',
        labelField: 'CecName',
      },
    },
    logSelectFilter('outcome', 'Result', ERP_CALL_OUTCOMES),
  ],
  columns: [
    { id: 'date', field: 'CelDateCreated', label: 'Date', kind: 'datetime' },
    { id: 'connection', field: 'ConnectionName', label: 'ERP integration', kind: 'related' },
    {
      id: 'tool',
      field: 'CelTool',
      label: 'Tool',
      kind: 'identity',
      detail: (row) => String(row['CelClass'] ?? ''),
    },
    {
      id: 'outcome',
      field: 'CelOutcome',
      label: 'Result',
      kind: 'status',
      options: ERP_CALL_OUTCOMES,
      translateValue: true,
      chipClass: (value) =>
        value === 'success'
          ? 'chip-success'
          : value === 'not_found'
            ? 'chip-skipped'
            : value === 'refused' || value === 'rejected'
              ? 'chip-warning'
              : 'chip-failed',
      detail: (row) => String(row['CelErrorCode'] ?? ''),
    },
    { id: 'http', field: 'CelHttpStatus', label: 'HTTP status', kind: 'number', optional: true },
    { id: 'latency', field: 'CelLatencyMs', label: 'Latency (ms)', kind: 'number', optional: true },
    {
      id: 'customer',
      field: 'CelExternalCustomerId',
      label: 'ERP customer',
      optional: true,
      value: (row) => String(row['CelExternalCustomerId'] ?? '') || '-',
    },
    {
      id: 'confirmation',
      field: 'CelConfirmationRef',
      label: 'Confirmation',
      optional: true,
      value: (row) => String(row['CelConfirmationRef'] ?? '') || '-',
    },
    {
      id: 'request',
      field: 'CelErpRequestId',
      label: 'ERP request',
      optional: true,
      value: (row) => String(row['CelErpRequestId'] ?? '') || '-',
    },
  ],
  fields: [],
});

@Component({
  selector: 'app-conversations-erp-calls',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ConversationsErpCallsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
