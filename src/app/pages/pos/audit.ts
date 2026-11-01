import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

export const POS_AUDIT_ACTIONS = [
  { value: 'terminal.created', label: 'Terminal created' },
  { value: 'terminal.updated', label: 'Terminal updated' },
  { value: 'terminal.deleted', label: 'Terminal deleted' },
  { value: 'terminal.fiscal_offline', label: 'Offline NFC-e changed' },
  { value: 'session.handoff', label: 'POS opened from the App' },
  { value: 'cash.opened', label: 'Register opened' },
  { value: 'cash.movement', label: 'Cash movement' },
  { value: 'cash.closed', label: 'Register closed' },
  { value: 'sale.submitted', label: 'Sale recorded' },
  { value: 'sale.canceled', label: 'Sale canceled' },
  { value: 'payment.confirmed', label: 'Payment confirmed' },
  { value: 'payment.declined', label: 'Payment declined' },
];
const ORIGINS = [
  { value: 'web', label: 'Online' },
  { value: 'device', label: 'Installed app' },
];

// Immutable record of POS actions, written by the database in the same transaction as each action;
// opened from Vendas › Contas it shows only the terminals of that account.
const config = defineCrud({
  endpoint: 'pos/audit-events',
  uuidField: 'PaeUUID',
  pageTitle: 'POS audit',
  pageDescription:
    'Who did what at each register: terminal changes, register opening and closing, cash movements, sales, cancelations and payments.',
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
    {
      key: 'action',
      label: 'Action',
      paramKey: 'action',
      type: 'select',
      span: 1,
      options: POS_AUDIT_ACTIONS,
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'occurred', label: 'When', field: 'PaeOccurredAt', kind: 'datetime' },
    { id: 'terminal', label: 'Terminal', field: 'TerminalName' },
    { id: 'action', label: 'Action', field: 'PaeAction', options: POS_AUDIT_ACTIONS },
    { id: 'actor', label: 'User', field: 'ActorName' },
    { id: 'origin', label: 'Origin', field: 'PaeOrigin', options: ORIGINS },
    { id: 'details', label: 'Details', field: 'PaeDetails', optional: true },
  ],
  fields: [],
});

@Component({
  selector: 'app-pos-audit-page',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class PosAuditPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
