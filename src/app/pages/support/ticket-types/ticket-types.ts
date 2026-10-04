import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { SupportDesk, YES_NO_OPTIONS, supportBase, supportDesk } from '../shared/support-desk';

function config(desk: SupportDesk) {
  return defineCrud({
    endpoint: `${supportBase(desk)}/ticket-types`,
    uuidField: 'SupportTicketTypeUUID',
    pageTitle: 'Ticket types',
    pageDescription:
      desk === 'platform'
        ? 'Types tenants choose when they open a ticket to the platform team.'
        : 'Types used to classify the tickets of your customers.',
    createTitle: 'New ticket type',
    editTitle: 'Edit ticket type',
    dialogDescription: 'The default type is preselected when a ticket is opened.',
    searchPlaceholder: 'Name or code',
    emptyLabel: 'No ticket types found.',
    deleteTitle: 'Delete ticket type',
    deleteMessage: 'Delete this ticket type? Existing tickets keep it.',
    savedMessage: 'Ticket type saved successfully.',
    deletedMessage: 'Ticket type deleted successfully.',
    deleteFailedMessage: 'Failed to delete ticket type.',
    bulkDelete: false,
    serverSidePagination: true,
    initialValues: { status: 1, name: '', code: '', description: '', sortOrder: 100, isDefault: 0 },
    columns: [
      { id: 'name', field: 'Name', label: 'Name', kind: 'identity' },
      { id: 'code', field: 'Code', label: 'Code' },
      { id: 'sortOrder', field: 'SortOrder', label: 'Order', kind: 'number' },
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
        help: 'Lowercase letters, digits, dashes or underscores (for example bug).',
        span: 1,
      },
      {
        key: 'sortOrder',
        source: 'SortOrder',
        payloadKey: 'sortOrder',
        label: 'Order',
        type: 'number',
        span: 1,
      },
      {
        key: 'isDefault',
        source: 'IsDefault',
        payloadKey: 'isDefault',
        label: 'Default type',
        type: 'search-select',
        options: YES_NO_OPTIONS,
        translateOptions: true,
        span: 1,
      },
      {
        key: 'description',
        source: 'Description',
        payloadKey: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 2,
        span: 4,
      },
    ],
  });
}

@Component({
  selector: 'app-support-ticket-types',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SupportTicketTypesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config(supportDesk(inject(ActivatedRoute))));
  }
}
