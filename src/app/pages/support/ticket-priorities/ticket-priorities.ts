import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { SupportDesk, YES_NO_OPTIONS, supportBase, supportDesk } from '../shared/support-desk';

function minutes(value: unknown): string {
  const total = Number(value);
  if (!Number.isFinite(total) || total <= 0) return '—';
  if (total % 1440 === 0) return `${total / 1440} d`;
  if (total % 60 === 0) return `${total / 60} h`;
  return `${total} min`;
}

function config(desk: SupportDesk) {
  return defineCrud({
    endpoint: `${supportBase(desk)}/ticket-priorities`,
    uuidField: 'SupportTicketPriorityUUID',
    pageTitle: 'Ticket priorities',
    pageDescription:
      'Each priority defines the SLA: deadline for the first response and for the resolution.',
    createTitle: 'New ticket priority',
    editTitle: 'Edit ticket priority',
    dialogDescription:
      'Lower rank means more urgent. A new priority on a ticket restarts its SLA from the opening time.',
    searchPlaceholder: 'Name or code',
    emptyLabel: 'No ticket priorities found.',
    deleteTitle: 'Delete ticket priority',
    deleteMessage: 'Delete this ticket priority? Existing tickets keep it.',
    savedMessage: 'Ticket priority saved successfully.',
    deletedMessage: 'Ticket priority deleted successfully.',
    deleteFailedMessage: 'Failed to delete ticket priority.',
    bulkDelete: false,
    serverSidePagination: true,
    initialValues: {
      status: 1,
      name: '',
      code: '',
      rank: 100,
      color: '',
      responseMinutes: 480,
      resolutionMinutes: 4320,
      isDefault: 0,
    },
    columns: [
      { id: 'name', field: 'Name', label: 'Name', kind: 'identity' },
      { id: 'code', field: 'Code', label: 'Code' },
      { id: 'rank', field: 'Rank', label: 'Rank', kind: 'number' },
      {
        id: 'response',
        field: 'ResponseMinutes',
        label: 'First response',
        value: (row) => minutes(row['ResponseMinutes']),
      },
      {
        id: 'resolution',
        field: 'ResolutionMinutes',
        label: 'Resolution',
        value: (row) => minutes(row['ResolutionMinutes']),
      },
      { id: 'isDefault', field: 'IsDefault', label: 'Default', kind: 'boolean' },
      { id: 'status', field: 'Status', label: 'Status', kind: 'status', className: 'status-col' },
    ],
    fields: [
      {
        key: 'status',
        source: 'Status',
        payloadKey: 'status',
        label: 'Status',
        type: 'status',
        span: 1,
      },
      { key: 'name', source: 'Name', payloadKey: 'name', label: 'Name', required: true, span: 2 },
      {
        key: 'code',
        source: 'Code',
        payloadKey: 'code',
        label: 'Code',
        required: true,
        help: 'Lowercase letters, digits, dashes or underscores (for example high).',
        span: 1,
      },
      {
        key: 'rank',
        source: 'Rank',
        payloadKey: 'rank',
        label: 'Rank',
        type: 'number',
        help: 'Lower is more urgent.',
        span: 1,
      },
      {
        key: 'responseMinutes',
        source: 'ResponseMinutes',
        payloadKey: 'responseMinutes',
        label: 'First response (minutes)',
        type: 'number',
        help: '0 or empty: no first response deadline.',
        span: 1,
      },
      {
        key: 'resolutionMinutes',
        source: 'ResolutionMinutes',
        payloadKey: 'resolutionMinutes',
        label: 'Resolution (minutes)',
        type: 'number',
        help: '0 or empty: no resolution deadline.',
        span: 1,
      },
      {
        key: 'color',
        source: 'Color',
        payloadKey: 'color',
        label: 'Color',
        help: 'Hex color, for example #2563eb.',
        span: 1,
      },
      {
        key: 'isDefault',
        source: 'IsDefault',
        payloadKey: 'isDefault',
        label: 'Default priority',
        type: 'search-select',
        options: YES_NO_OPTIONS,
        translateOptions: true,
        span: 1,
      },
    ],
  });
}

@Component({
  selector: 'app-support-ticket-priorities',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SupportTicketPrioritiesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config(supportDesk(inject(ActivatedRoute))));
  }
}
