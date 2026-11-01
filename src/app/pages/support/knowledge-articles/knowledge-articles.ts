import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const PUBLISH_OPTIONS = [
  { value: 1, label: 'Published' },
  { value: 0, label: 'Draft' },
];

/** How-to articles the support assistant may use (and cite) when it answers usage questions. */
const config = defineCrud({
  endpoint: 'system/support/knowledge-articles',
  uuidField: 'SupportKnowledgeArticleUUID',
  pageTitle: 'Knowledge articles',
  pageDescription:
    'How-to answers the support assistant uses, together with the App screens, to reply to usage questions.',
  createTitle: 'New knowledge article',
  editTitle: 'Edit knowledge article',
  dialogDescription:
    'Write the steps the way a customer should follow them. Only published articles are used by the assistant.',
  searchPlaceholder: 'Title, keywords, menu path or content',
  emptyLabel: 'No knowledge articles found.',
  deleteTitle: 'Delete knowledge article',
  deleteMessage: 'Delete this knowledge article? The assistant stops using it.',
  savedMessage: 'Knowledge article saved successfully.',
  deletedMessage: 'Knowledge article deleted successfully.',
  deleteFailedMessage: 'Failed to delete knowledge article.',
  bulkDelete: false,
  serverSidePagination: true,
  statusOptions: PUBLISH_OPTIONS,
  initialValues: { status: 1, title: '', body: '', menuPath: '', route: '', keywords: '' },
  columns: [
    {
      id: 'title',
      field: 'Title',
      label: 'Title',
      kind: 'identity',
      detail: (row) => String(row['MenuPath'] ?? ''),
    },
    { id: 'keywords', field: 'Keywords', label: 'Keywords', width: 'md' },
    { id: 'route', field: 'Route', label: 'App route', width: 'md', optional: true },
    { id: 'updated', field: 'DateUpdated', label: 'Updated at', kind: 'datetime' },
    {
      id: 'status',
      field: 'Status',
      label: 'Status',
      kind: 'status',
      options: PUBLISH_OPTIONS,
      translateValue: true,
      className: 'status-col',
    },
  ],
  fields: [
    {
      key: 'status',
      source: 'Status',
      payloadKey: 'status',
      label: 'Status',
      type: 'search-select',
      options: PUBLISH_OPTIONS,
      translateOptions: true,
      span: 1,
    },
    { key: 'title', source: 'Title', payloadKey: 'title', label: 'Title', required: true, span: 1 },
    {
      key: 'menuPath',
      source: 'MenuPath',
      payloadKey: 'menuPath',
      label: 'Menu path',
      help: 'Where the customer finds it, exactly as the menu shows it, for example Suporte › Meus chamados.',
    },
    {
      key: 'route',
      source: 'Route',
      payloadKey: 'route',
      label: 'App route',
      help: 'Optional App path starting with /, for example /support/requests.',
      span: 1,
    },
    {
      key: 'keywords',
      source: 'Keywords',
      payloadKey: 'keywords',
      label: 'Keywords',
      help: 'Words customers use for this subject, separated by spaces or commas.',
      span: 1,
    },
    {
      key: 'body',
      source: 'Body',
      payloadKey: 'body',
      label: 'Content',
      type: 'textarea',
      required: true,
      help: 'Plain text with numbered steps. Do not include passwords, internal links or customer data.',
      span: 4,
    },
  ],
  payload: (values) => ({
    status: Number(values['status'] ?? 1),
    title: values['title'],
    body: values['body'],
    menuPath: values['menuPath'] || null,
    route: values['route'] || null,
    keywords: values['keywords'] || null,
  }),
});

@Component({
  selector: 'app-support-knowledge-articles',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SupportKnowledgeArticlesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    return {
      ...payload,
      ...(this.editingRecord() ? { expectedRevision: this.editingRecord()?.['Revision'] } : {}),
    };
  }
}
