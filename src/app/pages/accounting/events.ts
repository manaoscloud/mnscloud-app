import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudFilterAction,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { ACCOUNTING_EVENT_STATUSES, ACCOUNTING_EVENT_TYPES } from './accounting-options';

const config = defineCrud({
  endpoint: 'accounting/events',
  uuidField: 'AevUUID',
  pageTitle: 'Accounting events',
  pageDescription:
    'One event per financial, fiscal and stock fact, with the accounts resolved by the mappings. Events are never edited; reversals and cancellations are new events.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  filterActions: [{ key: 'post', label: 'Post pending', icon: 'playlist_add_check' }],
  listFilters: [
    {
      key: 'status',
      label: 'Status',
      paramKey: 'status',
      type: 'select',
      span: 1,
      options: ACCOUNTING_EVENT_STATUSES,
      emptyLabel: 'All',
    },
    {
      key: 'eventType',
      label: 'Event',
      paramKey: 'eventType',
      type: 'select',
      span: 2,
      options: ACCOUNTING_EVENT_TYPES,
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'when', label: 'Occurred at', field: 'AevOccurredAt', kind: 'datetime' },
    { id: 'event', label: 'Event', field: 'AevEventType', options: ACCOUNTING_EVENT_TYPES },
    { id: 'amount', label: 'Amount', field: 'AevAmount', kind: 'currency' },
    { id: 'debit', label: 'Debit account', field: 'AevDebitAccount' },
    { id: 'credit', label: 'Credit account', field: 'AevCreditAccount' },
    { id: 'status', label: 'Status', field: 'AevStatus', options: ACCOUNTING_EVENT_STATUSES },
    { id: 'description', label: 'Description', field: 'AevDescription', optional: true },
    { id: 'attribute', label: 'Attribute', field: 'AevAttribute', optional: true },
    { id: 'company', label: 'Company', field: 'CompanyName', optional: true },
    { id: 'costCenter', label: 'Cost center', field: 'CostCenterCode', optional: true },
    { id: 'error', label: 'Error', field: 'AevError', optional: true },
  ],
  fields: [],
});

@Component({
  selector: 'app-accounting-events',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AccountingEventsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async handleFilterAction(action: ConfigurableCrudFilterAction): Promise<void> {
    if (action.key !== 'post') return;
    try {
      const response = await this.api.post<{ data?: { posted?: number; errors?: number } }>(
        'accounting/events/post',
        {},
      );
      this.snack.success(
        this.t('{{ posted }} events posted; {{ errors }} without account mapping.', {
          posted: Number(response?.data?.posted ?? 0),
          errors: Number(response?.data?.errors ?? 0),
        }),
      );
      this.itemsResource.reload();
    } catch {
      this.snack.error(this.t('Accounting events could not be posted.'));
    }
  }
}
