import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

export const WORK_ORDER_KINDS = [
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'REPLACEMENT', label: 'Replacement' },
  { value: 'OTHER', label: 'Other' },
];
export const WORK_ORDER_STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
export const WORK_ORDER_PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];
const TRANSITIONS = [
  { value: 'IN_PROGRESS', label: 'Start' },
  { value: 'ON_HOLD', label: 'Put on hold' },
  { value: 'DONE', label: 'Finish' },
  { value: 'CANCELLED', label: 'Cancel' },
  { value: 'OPEN', label: 'Reopen' },
];
const EVENT_KINDS = [
  { value: 'CREATED', label: 'Created' },
  { value: 'STATUS', label: 'Status' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'UPDATED', label: 'Changed' },
  { value: 'NOTE', label: 'Note' },
];

const label = (options: readonly { value: string; label: string }[], value: unknown) =>
  options.find((option) => option.value === value)?.label ?? String(value ?? '');

/** Chip color by status: running work in blue, waiting in amber, closed in grey or green. */
export function statusChip(value: unknown): string {
  switch (value) {
    case 'IN_PROGRESS':
      return 'chip-running';
    case 'ON_HOLD':
      return 'chip-warning';
    case 'DONE':
      return 'chip-success';
    case 'CANCELLED':
      return 'chip-skipped';
    default:
      return 'chip-queued';
  }
}

/** Status moves offered for a row (the API still decides). */
export function allowedTransitions(status: unknown): string[] {
  switch (status) {
    case 'OPEN':
      return ['IN_PROGRESS', 'CANCELLED'];
    case 'ASSIGNED':
      return ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'];
    case 'IN_PROGRESS':
      return ['ON_HOLD', 'DONE', 'CANCELLED'];
    case 'ON_HOLD':
      return ['IN_PROGRESS', 'CANCELLED'];
    default:
      return ['OPEN'];
  }
}

const lookup = (
  key: string,
  source: string,
  fieldLabel: string,
  endpoint: string,
  uuidField: string,
  labelField: string,
  selectedLabelField: string,
): ConfigurableCrudField => ({
  key,
  source,
  label: fieldLabel,
  type: 'search-select',
  remoteLookup: { endpoint, uuidField, labelField, selectedLabelField },
  tab: 'match',
  span: 2,
});

function timeline(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `workorders/orders/${String(row['WorUUID'])}/events`,
    uuidField: 'WoeUUID',
    pageTitle: 'Work order timeline',
    pageDescription: `#${String(row['WorID'] ?? '')} · ${String(row['WorTitle'] ?? '')}`,
    emptyLabel: 'No events.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    initialValues: {},
    fields: [],
    columns: [
      { id: 'date', field: 'WoeDateCreated', label: 'Date', kind: 'datetime' },
      {
        id: 'kind',
        field: 'WoeKind',
        label: 'Event',
        value: (event, t) => t(label(EVENT_KINDS, event['WoeKind'])),
      },
      {
        id: 'status',
        field: 'WoeToStatus',
        label: 'Status',
        value: (event, t) =>
          event['WoeToStatus'] ? t(label(WORK_ORDER_STATUSES, event['WoeToStatus'])) : '',
      },
      { id: 'note', field: 'WoeNote', label: 'Note', width: 'lg' },
      { id: 'actor', field: 'ActorName', label: 'By' },
    ],
  });
}

function statusForm(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  const options = TRANSITIONS.filter((option) =>
    allowedTransitions(row['WorStatus']).includes(option.value),
  );
  return defineCrud({
    endpoint: `workorders/orders/${String(row['WorUUID'])}/status`,
    uuidField: 'WorUUID',
    pageTitle: 'Change status',
    pageDescription: `#${String(row['WorID'] ?? '')} · ${String(row['WorTitle'] ?? '')}`,
    createTitle: 'Change status',
    dialogDescription:
      'Finishing needs what was done and every required checklist item; cancelling needs the reason.',
    savedMessage: 'Status changed.',
    statusFilter: false,
    initialValues: { status: options[0]?.value ?? '', note: '' },
    columns: [],
    fields: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options,
        translateOptions: true,
        required: true,
        span: 4,
      },
      { key: 'note', label: 'Note', type: 'textarea', rows: 3, span: 4 },
    ],
  });
}

function noteForm(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `workorders/orders/${String(row['WorUUID'])}/notes`,
    uuidField: 'WorUUID',
    pageTitle: 'Add note',
    pageDescription: `#${String(row['WorID'] ?? '')} · ${String(row['WorTitle'] ?? '')}`,
    createTitle: 'Add note',
    savedMessage: 'Note added.',
    statusFilter: false,
    initialValues: { note: '' },
    columns: [],
    fields: [{ key: 'note', label: 'Note', type: 'textarea', rows: 4, required: true, span: 4 }],
  });
}

const MATERIAL_STATUSES = [
  { value: 'PLANNED', label: 'Planned' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'REVERSED', label: 'Returned' },
];

/** Products of Stock planned for the order and issued once it started (one stock movement each). */
function materials(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `workorders/orders/${String(row['WorUUID'])}/materials`,
    deleteEndpoint: 'workorders/materials',
    uuidField: 'WomUUID',
    pageTitle: 'Work order materials',
    pageDescription: `#${String(row['WorID'] ?? '')} · ${String(row['WorTitle'] ?? '')}`,
    createTitle: 'Add material',
    emptyLabel: 'No materials.',
    savedMessage: 'Material added.',
    canEdit: false,
    bulkDelete: false,
    statusFilter: false,
    canDeleteRow: (material) => material['WomStatus'] !== 'ISSUED',
    initialValues: { quantity: 1 },
    fields: [
      {
        key: 'productUUID',
        label: 'Product',
        type: 'search-select',
        required: true,
        remoteLookup: { endpoint: 'sale/products', uuidField: 'SprUUID', labelField: 'SprName' },
        quickCreate: false,
        quickCreateExemptReason: 'Stock products are registered in Sales › Products.',
        span: 2,
      },
      {
        key: 'locationUUID',
        label: 'Stock location',
        type: 'search-select',
        required: true,
        remoteLookup: { endpoint: 'stock/locations', uuidField: 'StlUUID', labelField: 'StlName' },
        quickCreate: false,
        quickCreateExemptReason: 'Stock locations are registered in Stock › Locations.',
        span: 2,
      },
      { key: 'quantity', label: 'Quantity', type: 'number', required: true, span: 1 },
      { key: 'notes', label: 'Notes', span: 3 },
    ],
    columns: [
      { id: 'product', field: 'ProductName', label: 'Product', kind: 'identity' },
      { id: 'location', field: 'LocationName', label: 'Stock location' },
      { id: 'quantity', field: 'WomQuantity', label: 'Quantity', kind: 'number' },
      {
        id: 'status',
        field: 'WomStatus',
        label: 'Status',
        kind: 'status',
        options: MATERIAL_STATUSES,
        chipClass: (value) =>
          value === 'ISSUED'
            ? 'chip-success'
            : value === 'REVERSED'
              ? 'chip-skipped'
              : 'chip-queued',
      },
      { id: 'notes', field: 'WomNotes', label: 'Notes' },
    ],
    rowActions: [
      {
        key: 'return',
        label: 'Return to stock',
        icon: 'undo',
        visible: (material) => material['WomStatus'] === 'ISSUED',
        request: {
          method: 'post',
          endpoint: (material) => `workorders/materials/${String(material['WomUUID'])}/reversal`,
          successMessage: 'Material returned to stock.',
        },
      },
    ],
  });
}

/** Checked state for a checklist row: done or open. */
const CHECK_STATES = [
  { value: '1', label: 'Done' },
  { value: '0', label: 'Open' },
];

/** The order checklist (template of its kind plus extra items); required items block finishing. */
function checklist(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  const closed = ['DONE', 'CANCELLED'].includes(String(row['WorStatus']));
  const check = (done: boolean) => ({
    method: 'put' as const,
    endpoint: (item: ConfigurableCrudRecord) => `workorders/checklist/${String(item['WciUUID'])}`,
    body: () => ({ done }),
    successMessage: done ? 'Item checked.' : 'Item unchecked.',
  });
  return defineCrud({
    endpoint: `workorders/orders/${String(row['WorUUID'])}/checklist`,
    updateEndpoint: 'workorders/checklist',
    deleteEndpoint: 'workorders/checklist',
    uuidField: 'WciUUID',
    pageTitle: 'Work order checklist',
    pageDescription: `#${String(row['WorID'] ?? '')} · ${String(row['WorTitle'] ?? '')}`,
    createTitle: 'Add checklist item',
    editTitle: 'Checklist item',
    emptyLabel: 'No checklist items. Checklists per kind are set in Work orders › Checklists.',
    savedMessage: 'Checklist saved.',
    canCreate: !closed,
    canEditRow: () => !closed,
    canDeleteRow: (item) => !closed && Number(item['WciExtra']) === 1,
    bulkDelete: false,
    statusFilter: false,
    initialValues: { required: '0', done: '0' },
    payload: (values, editing) =>
      editing
        ? { done: values['done'] === '1', note: values['note'] ?? '' }
        : { label: values['label'], required: values['required'] === '1' },
    fields: [
      {
        key: 'label',
        source: 'WciLabel',
        label: 'Item',
        span: 4,
        requiredWhen: ({ editing }) => !editing,
        hiddenWhen: ({ editing }) => editing,
      },
      {
        key: 'required',
        hiddenWhen: ({ editing }) => editing,
        source: 'WciRequired',
        label: 'Required to finish',
        type: 'select',
        options: [
          { value: '1', label: 'Yes' },
          { value: '0', label: 'No' },
        ],
        translateOptions: true,
        span: 2,
      },
      {
        key: 'done',
        source: 'WciDone',
        hiddenWhen: ({ editing }) => !editing,
        label: 'Status',
        type: 'select',
        options: CHECK_STATES,
        translateOptions: true,
        span: 2,
      },
      {
        key: 'note',
        source: 'WciNote',
        label: 'Note',
        type: 'textarea',
        rows: 2,
        span: 4,
        hiddenWhen: ({ editing }) => !editing,
      },
    ],
    columns: [
      { id: 'item', field: 'WciLabel', label: 'Item', kind: 'identity', width: 'lg' },
      {
        id: 'done',
        field: 'WciDone',
        label: 'Status',
        kind: 'status',
        options: CHECK_STATES,
        chipClass: (value) => (String(value) === '1' ? 'chip-success' : 'chip-queued'),
      },
      { id: 'required', field: 'WciRequired', label: 'Required', kind: 'boolean' },
      { id: 'note', field: 'WciNote', label: 'Note' },
      {
        id: 'by',
        field: 'DoneByName',
        label: 'By',
        detail: (item) => String(item['WciDoneAt'] ?? ''),
      },
    ],
    rowActions: [
      {
        key: 'check',
        label: 'Check',
        icon: 'check_box',
        inline: true,
        visible: (item) => !closed && Number(item['WciDone']) !== 1,
        request: check(true),
      },
      {
        key: 'uncheck',
        label: 'Uncheck',
        icon: 'check_box_outline_blank',
        inline: true,
        visible: (item) => !closed && Number(item['WciDone']) === 1,
        request: check(false),
      },
    ],
  });
}

/** `done/total` of the order checklist ('' without one). */
export function checklistProgress(row: ConfigurableCrudRecord): string {
  const total = Number(row['ChecklistTotal'] ?? 0);
  return total > 0 ? `${Number(row['ChecklistDone'] ?? 0)}/${total}` : '';
}

/** Work orders of the tenant; `mine` lists the ones assigned to the signed-in technician. */
export function workOrdersConfig(mine: boolean): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: 'workorders/orders',
    ...(mine ? { listQuery: { mine: '1' } } : {}),
    uuidField: 'WorUUID',
    pageTitle: mine ? 'My work orders' : 'Work orders',
    pageDescription: mine
      ? 'Work orders assigned to you, the ones in progress first.'
      : 'Field work orders linked to assets, customers and support tickets.',
    createTitle: 'New work order',
    editTitle: 'Edit work order',
    savedMessage: 'Work order saved.',
    bulkDelete: false,
    statusFilter: false,
    serverSidePagination: true,
    tabLabels: { match: 'Links', monitoring: 'Place and dates' },
    listFilters: [
      {
        key: 'status',
        label: 'Status',
        paramKey: 'status',
        type: 'select',
        span: 1,
        options: WORK_ORDER_STATUSES,
        emptyLabel: 'All',
      },
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
    initialValues: { kind: 'REPAIR', priority: 'NORMAL' },
    canEditRow: (row) => !['DONE', 'CANCELLED'].includes(String(row['WorStatus'])),
    canDeleteRow: (row) => ['OPEN', 'ASSIGNED', 'CANCELLED'].includes(String(row['WorStatus'])),
    columns: [
      { id: 'number', label: 'Number', field: 'WorID', uuidField: 'WorUUID', kind: 'identity' },
      { id: 'title', label: 'Title', field: 'WorTitle', width: 'lg' },
      {
        id: 'status',
        label: 'Status',
        field: 'WorStatus',
        kind: 'status',
        options: WORK_ORDER_STATUSES,
        chipClass: (value) => statusChip(value),
      },
      {
        id: 'priority',
        label: 'Priority',
        field: 'WorPriority',
        value: (row, t) => t(label(WORK_ORDER_PRIORITIES, row['WorPriority'])),
      },
      {
        id: 'kind',
        label: 'Kind',
        field: 'WorKind',
        value: (row, t) => t(label(WORK_ORDER_KINDS, row['WorKind'])),
      },
      { id: 'asset', label: 'Asset', field: 'AssetName' },
      { id: 'customer', label: 'Customer', field: 'CustomerName', optional: true },
      { id: 'assignee', label: 'Technician', field: 'AssigneeName' },
      {
        id: 'due',
        label: 'Due',
        field: 'WorDueAt',
        kind: 'datetime',
        detail: (row) => (Number(row['Overdue']) === 1 ? 'Overdue' : ''),
      },
      {
        id: 'checklist',
        label: 'Checklist',
        field: 'ChecklistDone',
        value: (row) => checklistProgress(row),
        detail: (row) =>
          Number(row['ChecklistRequiredOpen'] ?? 0) > 0 ? 'Required items open' : '',
      },
      { id: 'ticket', label: 'Ticket', field: 'TicketSubject', optional: true },
      { id: 'address', label: 'Address', field: 'WorAddress', optional: true },
    ],
    fields: [
      { key: 'title', source: 'WorTitle', label: 'Title', required: true, span: 4 },
      {
        key: 'kind',
        source: 'WorKind',
        label: 'Kind',
        type: 'select',
        options: WORK_ORDER_KINDS,
        translateOptions: true,
        span: 2,
      },
      {
        key: 'priority',
        source: 'WorPriority',
        label: 'Priority',
        type: 'select',
        options: WORK_ORDER_PRIORITIES,
        translateOptions: true,
        span: 2,
      },
      {
        key: 'description',
        source: 'WorDescription',
        label: 'Description',
        type: 'textarea',
        rows: 4,
        span: 4,
      },
      lookup(
        'assigneeUUID',
        'AssigneeUserUsrUUID',
        'Technician',
        'workorders/assignees',
        'UsrUUID',
        'UsrName',
        'AssigneeName',
      ),
      lookup(
        'assetUUID',
        'InfraGisAssetIgaUUID',
        'Asset',
        'infragis/assets',
        'IgaUUID',
        'IgaName',
        'AssetName',
      ),
      lookup(
        'customerUUID',
        'RegCustomerRcuUUID',
        'Customer',
        'registry/customers',
        'RcuUUID',
        'RcuName',
        'CustomerName',
      ),
      lookup(
        'ticketUUID',
        'SupportTicketStkUUID',
        'Support ticket',
        'support/tickets',
        'SupportTicketUUID',
        'Subject',
        'TicketSubject',
      ),
      {
        key: 'scheduledAt',
        source: 'WorScheduledAt',
        label: 'Scheduled for',
        type: 'datetime',
        tab: 'monitoring',
        span: 2,
      },
      {
        key: 'dueAt',
        source: 'WorDueAt',
        label: 'Due',
        type: 'datetime',
        tab: 'monitoring',
        span: 2,
      },
      { key: 'address', source: 'WorAddress', label: 'Address', tab: 'monitoring', span: 4 },
      {
        key: 'latitude',
        source: 'WorLatitude',
        label: 'Latitude',
        type: 'number',
        tab: 'monitoring',
        span: 2,
      },
      {
        key: 'longitude',
        source: 'WorLongitude',
        label: 'Longitude',
        type: 'number',
        tab: 'monitoring',
        span: 2,
      },
    ],
    rowActions: [
      { key: 'status', label: 'Change status', icon: 'published_with_changes', form: statusForm },
      { key: 'note', label: 'Add note', icon: 'note_add', form: noteForm },
      { key: 'checklist', label: 'Checklist', icon: 'checklist', collection: checklist },
      { key: 'timeline', label: 'Timeline', icon: 'timeline', collection: timeline },
      { key: 'materials', label: 'Materials', icon: 'inventory', collection: materials },
      {
        key: 'issue-materials',
        label: 'Issue materials from stock',
        icon: 'outbox',
        visible: (row) => ['IN_PROGRESS', 'ON_HOLD', 'DONE'].includes(String(row['WorStatus'])),
        request: {
          method: 'post',
          endpoint: (row) => `workorders/orders/${String(row['WorUUID'])}/materials/issue`,
          successMessage: 'Materials issued from stock.',
          confirm: {
            title: 'Issue materials from stock',
            message:
              'The planned materials leave the stock now. Missing quantities stop the whole issue.',
            confirmLabel: 'Issue',
          },
        },
      },
    ],
  });
}

@Component({
  selector: 'app-work-orders',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class WorkOrdersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(workOrdersConfig(inject(ActivatedRoute).snapshot.data['mine'] === true));
  }
}

/**
 * Quick "new work order" form for another page (an InfraGIS asset, a support ticket): the link is a
 * hidden field and the title starts from the source.
 */
export function workOrderQuickForm(
  links: Readonly<Record<'assetUUID' | 'customerUUID' | 'ticketUUID', string | null>>,
  title: string,
): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: 'workorders/orders',
    uuidField: 'WorUUID',
    pageTitle: 'New work order',
    pageDescription: title,
    createTitle: 'New work order',
    savedMessage: 'Work order saved.',
    statusFilter: false,
    initialValues: { ...links, title, kind: 'REPAIR', priority: 'NORMAL' },
    columns: [],
    fields: [
      { key: 'title', label: 'Title', required: true, span: 4 },
      {
        key: 'kind',
        label: 'Kind',
        type: 'select',
        options: WORK_ORDER_KINDS,
        translateOptions: true,
        span: 2,
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        options: WORK_ORDER_PRIORITIES,
        translateOptions: true,
        span: 2,
      },
      {
        key: 'assigneeUUID',
        label: 'Technician',
        type: 'search-select',
        remoteLookup: {
          endpoint: 'workorders/assignees',
          uuidField: 'UsrUUID',
          labelField: 'UsrName',
        },
        span: 2,
      },
      { key: 'dueAt', label: 'Due', type: 'datetime', span: 2 },
      { key: 'description', label: 'Description', type: 'textarea', rows: 3, span: 4 },
      { key: 'assetUUID', label: 'Asset', hidden: true, span: 4 },
      { key: 'customerUUID', label: 'Customer', hidden: true, span: 4 },
      { key: 'ticketUUID', label: 'Support ticket', hidden: true, span: 4 },
    ],
  });
}
