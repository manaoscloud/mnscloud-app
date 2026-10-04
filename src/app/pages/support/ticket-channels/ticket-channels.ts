import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { SupportDesk, supportBase, supportDesk } from '../shared/support-desk';

function config(desk: SupportDesk) {
  return defineCrud({
    endpoint: `${supportBase(desk)}/ticket-channels`,
    uuidField: 'SupportTicketChannelUUID',
    pageTitle: 'Ticket origins',
    pageDescription:
      desk === 'platform'
        ? 'Where platform tickets come from. app_report and help_center are used by the App.'
        : 'Where the tickets of your customers come from.',
    createTitle: 'New ticket origin',
    editTitle: 'Edit ticket origin',
    dialogDescription: 'The code identifies the origin in integrations.',
    searchPlaceholder: 'Name or code',
    emptyLabel: 'No ticket origins found.',
    deleteTitle: 'Delete ticket origin',
    deleteMessage: 'Delete this ticket origin? Existing tickets keep it.',
    savedMessage: 'Ticket origin saved successfully.',
    deletedMessage: 'Ticket origin deleted successfully.',
    deleteFailedMessage: 'Failed to delete ticket origin.',
    bulkDelete: false,
    serverSidePagination: true,
    initialValues: { status: 1, name: '', code: '', description: '' },
    columns: [
      { id: 'name', field: 'Name', label: 'Name', kind: 'identity' },
      { id: 'code', field: 'Code', label: 'Code' },
      { id: 'description', field: 'Description', label: 'Description' },
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
        help: 'Lowercase letters, digits, dashes or underscores.',
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
  selector: 'app-support-ticket-channels',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SupportTicketChannelsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config(supportDesk(inject(ActivatedRoute))));
  }
}
