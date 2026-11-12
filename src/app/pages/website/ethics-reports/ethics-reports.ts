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

export const WEBSITE_ETHICS_CATEGORY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'discrimination', label: 'Discrimination' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'safety', label: 'Safety' },
  { value: 'conduct', label: 'Conduct' },
  { value: 'other', label: 'Other' },
];

export const WEBSITE_ETHICS_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In review' },
  { value: 'closed', label: 'Closed' },
];

/** Reports sent through the ethics channel of the tenant websites; anonymous ones hold no identity. */
const config = defineCrud({
  endpoint: 'website/ethics-reports',
  uuidField: 'ReportUUID',
  pageTitle: 'Ethics',
  pageDescription:
    'Reports received through the ethics channel of your websites. Anonymous reports keep no identification; review each one and record the outcome in the notes.',
  editTitle: 'Review report',
  dialogDescription: 'Update the status of the report and keep internal notes.',
  searchPlaceholder: 'Protocol, place or message',
  emptyLabel: 'No reports found',
  deleteTitle: 'Delete report',
  deleteMessage: 'Delete this report?',
  deleteSelectedTitle: 'Delete reports',
  deleteSelectedMessage: 'Delete {count} selected reports?',
  savedMessage: 'Report saved.',
  deletedMessage: 'Report deleted.',
  deleteFailedMessage: 'Failed to delete report.',
  canCreate: false,
  bulkDelete: true,
  serverSidePagination: true,
  initialPageSize: 25,
  statusMode: 'string',
  activeValue: 'new',
  inactiveValue: 'closed',
  statusOptions: WEBSITE_ETHICS_STATUS_OPTIONS,
  rowActions: WEBSITE_INBOX_ROW_ACTIONS,
  listFilters: [
    {
      key: 'category',
      label: 'Category',
      paramKey: 'category',
      type: 'select',
      span: 1,
      options: WEBSITE_ETHICS_CATEGORY_OPTIONS,
    },
  ],
  initialValues: WEBSITE_INBOX_INITIAL_VALUES,
  payload: (values) => websiteInboxPayload(values),
  columns: [
    {
      id: 'protocol',
      field: 'Protocol',
      label: 'Protocol',
      kind: 'identity',
      uuidField: 'ReportUUID',
      rowAction: 'view',
    },
    {
      id: 'category',
      field: 'Category',
      label: 'Category',
      kind: 'status',
      options: WEBSITE_ETHICS_CATEGORY_OPTIONS,
    },
    { id: 'anonymous', field: 'Anonymous', label: 'Anonymous', kind: 'boolean', width: 'xs' },
    { id: 'site', field: 'SiteName', label: 'Site' },
    { id: 'dateCreated', field: 'DateCreated', label: 'Created at', kind: 'datetime' },
    websiteInboxStatusColumn(WEBSITE_ETHICS_STATUS_OPTIONS),
  ],
  fields: websiteInboxFields(WEBSITE_ETHICS_STATUS_OPTIONS),
});

@Component({
  selector: 'app-website-ethics-reports',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class WebsiteEthicsReportsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override handleRowAction(action: { key: string }, row: ConfigurableCrudRecord) {
    if (action.key !== 'view') return;
    const option = inboxOptionLabel;
    const anonymous = row['Anonymous'] === true;
    const identity = (value: unknown) => (anonymous ? 'Anonymous' : value);
    openInboxViewer(this.dialog, {
      title: text(row['Protocol']) || 'Ethics',
      status: { value: option(WEBSITE_ETHICS_STATUS_OPTIONS, row['Status']) },
      details: [
        {
          label: 'Category',
          value: option(WEBSITE_ETHICS_CATEGORY_OPTIONS, row['Category']),
          translate: true,
        },
        { label: 'Site', value: row['SiteName'] },
        { label: 'Place', value: row['Place'] },
        { label: 'Name', value: identity(row['Name']), translate: anonymous },
        { label: 'E-mail', value: identity(row['Email']), translate: anonymous },
        { label: 'Phone', value: identity(row['Phone']), translate: anonymous },
        { label: 'Created at', value: row['DateCreated'], kind: 'datetime' },
      ],
      sections: [{ title: 'Message', message: row['Message'] }],
    });
  }
}
