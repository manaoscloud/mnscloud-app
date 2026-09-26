import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../../shared/crud/configurable-crud/define-crud';

const days = Array.from({ length: 31 }, (_, index) => ({
  value: index + 1,
  label: String(index + 1),
}));

const config = defineCrud({
  endpoint: 'erp/financial/invoicing/duedays',
  uuidField: 'ErpFinInvDueDayUUID',
  pageTitle: 'Due Days',
  pageDescription: 'Configure due day, billing day and closed month rules.',
  searchPlaceholder: 'Search rules',
  bulkDelete: true,
  statusMode: 'string',
  activeValue: 'active',
  inactiveValue: 'inactive',
  initialValues: { status: 'active', name: '', dueDay: 10, billingDay: 1, closedMonth: 0 },
  columns: [
    {
      id: 'name',
      label: 'Name',
      field: 'Name',
      uuidField: 'ErpFinInvDueDayUUID',
      kind: 'identity',
    },
    { id: 'dueDay', label: 'Due day', field: 'DueDay', kind: 'number' },
    { id: 'billingDay', label: 'Billing day', field: 'BillingDay', kind: 'number' },
    { id: 'closedMonth', label: 'Closed month', field: 'ClosedMonth', kind: 'boolean' },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'Status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'Name', label: 'Name', required: true, span: 1 },
    {
      key: 'dueDay',
      source: 'DueDay',
      label: 'Due day',
      type: 'select',
      options: days,
      translateOptions: false,
      required: true,
      span: 1,
    },
    {
      key: 'billingDay',
      source: 'BillingDay',
      label: 'Billing day',
      type: 'select',
      options: days,
      translateOptions: false,
      required: true,
      span: 1,
    },
    {
      key: 'closedMonth',
      source: 'ClosedMonth',
      fromRecord: (value) => (value === true || Number(value) === 1 ? 1 : 0),
      label: 'Closed month',
      type: 'select',
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
      span: 1,
    },
  ],
});

@Component({
  selector: 'app-invoicing-duedays',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class InvoicingDueDaysPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      dueDay: Number(payload['dueDay']),
      billingDay: Number(payload['billingDay']),
      closedMonth: Number(payload['closedMonth']) === 1,
    };
  }
}
