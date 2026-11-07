import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import {
  DOCUMENT_LOOKUP,
  TARGET_TYPE_OPTIONS,
} from '../contracts.common';

export const CONTRACT_LINKS_CONFIG = defineCrud({
  endpoint: 'contracts/links',
  uuidField: 'CtlUUID',
  pageTitle: 'contracts.links',
  pageDescription: 'contracts.linksDescription',
  createTitle: 'contracts.newLink',
  editTitle: 'contracts.editLink',
  serverSidePagination: true,
  bulkDelete: true,
  initialValues: {
    contractDocumentUuid: '',
    targetType: 'crm_proposal',
    targetUuid: '',
    notes: '',
  },
  ...revisionDeletePayloads('CtlUUID', 'CtlRevision'),
  listFilters: [
    { key: 'targetType', label: 'contracts.targetType', type: 'select', span: 1, options: TARGET_TYPE_OPTIONS },
    { key: 'contractDocumentUuid', label: 'contracts.document', type: 'search-select', span: 1, remoteLookup: DOCUMENT_LOOKUP },
  ],
  fields: [
    {
      key: 'contractDocumentUuid',
      source: 'ContractDocumentCtdUUID',
      label: 'contracts.document',
      type: 'search-select',
      required: true,
      span: 1,
      remoteLookup: DOCUMENT_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason: 'Contract documents are generated or imported through the document lifecycle workflow, not created from an inline modal.',
    },
    { key: 'targetType', source: 'CtlTargetType', label: 'contracts.targetType', type: 'select', required: true, span: 1, options: TARGET_TYPE_OPTIONS },
    { key: 'targetUuid', source: 'CtlTargetUUID', label: 'contracts.targetUuid', type: 'text', required: true, span: 1 },
    { key: 'notes', source: 'CtlNotes', label: 'contracts.notes', type: 'textarea', span: 4 },
  ],
  columns: [
    { id: 'documentNumber', field: 'DocumentNumber', label: 'contracts.documentNumber', kind: 'identity' },
    { id: 'documentTitle', field: 'DocumentTitle', label: 'contracts.document' },
    { id: 'documentState', field: 'DocumentState', label: 'contracts.documentState' },
    { id: 'targetType', field: 'CtlTargetType', label: 'contracts.targetType' },
    { id: 'notes', field: 'CtlNotes', label: 'contracts.notes' },
    { id: 'dateCreated', field: 'CtlDateCreated', label: 'contracts.dateCreated' },
  ],
});

@Component({
  selector: 'mns-contracts-links',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ContractsLinksComponent extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(CONTRACT_LINKS_CONFIG);
  }
}
