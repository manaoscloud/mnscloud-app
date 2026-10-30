import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { WORK_ORDER_KINDS, WORK_ORDER_PRIORITIES } from './orders';

const label = (options: readonly { value: string; label: string }[], value: unknown) =>
  options.find((option) => option.value === value)?.label ?? String(value ?? '');

const YES_NO = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

/** Checklist items per order kind, copied into each new order of that kind. */
export function checklistTemplatesConfig(): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: 'workorders/checklist-templates',
    uuidField: 'WctUUID',
    pageTitle: 'Work order checklists',
    pageDescription:
      'What the technician checks on each kind of order. New orders get a copy; required items must be checked to finish.',
    createTitle: 'New checklist item',
    editTitle: 'Edit checklist item',
    emptyLabel: 'No checklist items yet.',
    savedMessage: 'Checklist item saved.',
    bulkDelete: false,
    statusFilter: false,
    listFilters: [
      {
        key: 'kind',
        label: 'Kind',
        paramKey: 'kind',
        type: 'select',
        span: 1,
        options: WORK_ORDER_KINDS,
        emptyLabel: 'All',
      },
    ],
    initialValues: { kind: 'INSTALLATION', required: '1', position: 0 },
    payload: (values) => ({ ...values, required: values['required'] === '1' }),
    fields: [
      {
        key: 'kind',
        source: 'WctKind',
        label: 'Kind',
        type: 'select',
        options: WORK_ORDER_KINDS,
        translateOptions: true,
        required: true,
        span: 2,
      },
      { key: 'position', source: 'WctPosition', label: 'Order', type: 'number', span: 1 },
      {
        key: 'required',
        source: 'WctRequired',
        label: 'Required to finish',
        type: 'select',
        options: YES_NO,
        translateOptions: true,
        span: 1,
      },
      { key: 'label', source: 'WctLabel', label: 'Item', required: true, span: 4 },
    ],
    columns: [
      {
        id: 'kind',
        field: 'WctKind',
        label: 'Kind',
        value: (row: ConfigurableCrudRecord, t) => t(label(WORK_ORDER_KINDS, row['WctKind'])),
      },
      { id: 'position', field: 'WctPosition', label: 'Order', kind: 'number' },
      { id: 'item', field: 'WctLabel', label: 'Item', kind: 'identity', width: 'lg' },
      { id: 'required', field: 'WctRequired', label: 'Required', kind: 'boolean' },
    ],
  });
}

/** Due hours per priority, applied when an order is created without a due date. */
export function dueRulesConfig(): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: 'workorders/due-rules',
    uuidField: 'WdrPriority',
    pageTitle: 'Work order due times',
    pageDescription:
      'Hours to finish an order of each priority, counted from its schedule (or creation). Overdue orders notify the technician.',
    editTitle: 'Due time',
    savedMessage: 'Due time saved.',
    canCreate: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    initialValues: {},
    fields: [
      {
        key: 'hours',
        source: 'WdrHours',
        label: 'Hours (empty for no due time)',
        type: 'number',
        span: 4,
      },
    ],
    columns: [
      {
        id: 'priority',
        field: 'WdrPriority',
        label: 'Priority',
        kind: 'identity',
        value: (row: ConfigurableCrudRecord, t) =>
          t(label(WORK_ORDER_PRIORITIES, row['WdrPriority'])),
      },
      { id: 'hours', field: 'WdrHours', label: 'Hours', kind: 'number' },
    ],
  });
}

@Component({
  selector: 'app-work-order-settings',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class WorkOrderSettingsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const page = inject(ActivatedRoute).snapshot.data['settings'];
    super(page === 'due-rules' ? dueRulesConfig() : checklistTemplatesConfig());
  }
}
