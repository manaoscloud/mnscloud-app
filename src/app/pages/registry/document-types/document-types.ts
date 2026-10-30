import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

export const DOCUMENT_TYPES_CONFIG = defineCrud({
  endpoint: 'registry/document-types',
  uuidField: 'RdtUUID',
  pageTitle: 'documents.types',
  pageDescription: 'documents.typesDescription',
  createTitle: 'documents.newType',
  editTitle: 'documents.editType',
  serverSidePagination: true,
  bulkDelete: true,
  initialValues: {
    name: '',
    description: '',
    status: 1,
    requireIssueDate: 0,
    requireExpiryDate: 0,
    requireReview: 0,
  },
  ...revisionDeletePayloads('RdtUUID', 'RdtRevision'),
  fields: [
    { key: 'status', source: 'RdtStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'RdtName', label: 'Name', required: true, span: 1 },
    {
      key: 'description',
      source: 'RdtDescription',
      label: 'Description',
      type: 'textarea',
      span: 1,
    },
    ...(
      [
        { key: 'requireIssueDate', label: 'documents.requireIssueDate' },
        {
          key: 'requireExpiryDate',
          label: 'documents.requireExpiryDate',
        },
        { key: 'requireReview', label: 'documents.requireReview' },
      ] as const
    ).map(({ key, label }) => ({
      key,
      source: 'Rdt' + key[0].toUpperCase() + key.slice(1),
      label,
      type: 'select' as const,
      span: 1 as const,
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes' },
      ],
    })),
    { key: 'revision', source: 'RdtRevision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'name', field: 'RdtName', label: 'Name', kind: 'identity' },
    { id: 'description', field: 'RdtDescription', label: 'Description' },
    { id: 'status', field: 'RdtStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-document-types',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegDocumentTypePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(DOCUMENT_TYPES_CONFIG);
  }
}
