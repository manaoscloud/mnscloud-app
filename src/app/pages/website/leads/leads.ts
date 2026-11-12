import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  WEBSITE_INBOX_INITIAL_VALUES,
  WEBSITE_INBOX_ROW_ACTIONS,
  inboxOptionLabel,
  openInboxViewer,
  text,
  websiteInboxFields,
  websiteInboxPayload,
  websiteInboxStatusColumn,
} from '../shared/website-inbox';

export { websiteInboxPayload };

export const WEBSITE_LEAD_KIND_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'contact', label: 'Contact' },
  { value: 'fleet', label: 'Fleet' },
];

export const WEBSITE_LEAD_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'closed', label: 'Closed' },
];

/** Contact and fleet requests sent by the forms of the tenant websites. */
const config = defineCrud({
  endpoint: 'website/leads',
  uuidField: 'LeadUUID',
  pageTitle: 'Leads',
  pageDescription:
    'Contact and fleet requests sent through your websites. Follow each one up and mark it as contacted or closed.',
  editTitle: 'Follow up lead',
  dialogDescription: 'Update the status of the request and keep internal notes.',
  searchPlaceholder: 'Name, e-mail, phone or company',
  emptyLabel: 'No leads found',
  deleteTitle: 'Delete lead',
  deleteMessage: 'Delete this lead?',
  deleteSelectedTitle: 'Delete leads',
  deleteSelectedMessage: 'Delete {count} selected leads?',
  savedMessage: 'Lead saved.',
  deletedMessage: 'Lead deleted.',
  deleteFailedMessage: 'Failed to delete lead.',
  canCreate: false,
  bulkDelete: true,
  serverSidePagination: true,
  initialPageSize: 25,
  statusMode: 'string',
  activeValue: 'new',
  inactiveValue: 'closed',
  statusOptions: WEBSITE_LEAD_STATUS_OPTIONS,
  rowActions: WEBSITE_INBOX_ROW_ACTIONS,
  listFilters: [
    {
      key: 'kind',
      label: 'Kind',
      paramKey: 'kind',
      type: 'select',
      span: 1,
      options: WEBSITE_LEAD_KIND_OPTIONS,
    },
  ],
  initialValues: WEBSITE_INBOX_INITIAL_VALUES,
  payload: (values) => websiteInboxPayload(values),
  columns: [
    {
      id: 'name',
      field: 'Name',
      label: 'Name',
      kind: 'identity',
      uuidField: 'LeadUUID',
      rowAction: 'view',
    },
    {
      id: 'kind',
      field: 'Kind',
      label: 'Kind',
      kind: 'status',
      options: WEBSITE_LEAD_KIND_OPTIONS,
    },
    { id: 'company', field: 'CompanyName', label: 'Company' },
    {
      id: 'contact',
      field: 'Email',
      label: 'Contact',
      value: (row) => [text(row['Email']), text(row['Phone'])].filter(Boolean).join(' · '),
    },
    { id: 'site', field: 'SiteName', label: 'Site' },
    { id: 'dateCreated', field: 'DateCreated', label: 'Created at', kind: 'datetime' },
    websiteInboxStatusColumn(WEBSITE_LEAD_STATUS_OPTIONS),
  ],
  fields: websiteInboxFields(WEBSITE_LEAD_STATUS_OPTIONS),
});

@Component({
  selector: 'app-website-leads',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class WebsiteLeadsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override handleRowAction(action: { key: string }, row: ConfigurableCrudRecord) {
    if (action.key !== 'view') return;
    const option = inboxOptionLabel;
    openInboxViewer(this.dialog, {
      title: text(row['Name']) || 'Leads',
      status: { value: option(WEBSITE_LEAD_STATUS_OPTIONS, row['Status']) },
      details: [
        { label: 'Kind', value: option(WEBSITE_LEAD_KIND_OPTIONS, row['Kind']), translate: true },
        { label: 'Company', value: row['CompanyName'] },
        { label: 'CNPJ', value: row['Document'], monospace: true },
        { label: 'E-mail', value: row['Email'] },
        { label: 'Phone', value: row['Phone'] },
        { label: 'Site', value: row['SiteName'] },
        { label: 'Fleet size', value: row['FleetSize'] },
        { label: 'Monthly liters', value: row['MonthlyLiters'] },
        { label: 'Fuels', value: row['Fuels'] },
        { label: 'Locations', value: row['Locations'], wide: true },
        { label: 'CRM lead', value: row['CrmLeadUUID'], monospace: true },
        { label: 'Created at', value: row['DateCreated'], kind: 'datetime' },
      ],
      sections: [{ title: 'Message', message: row['Message'] }],
    });
  }
}
