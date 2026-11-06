import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import {
  ADJUSTMENT_INDEX_OPTIONS,
  CONTRACT_ACCOUNT_LOOKUP,
  CONTRACT_KIND_OPTIONS,
  DOC_TYPE_LOOKUP,
  SIGNATURE_LEVEL_OPTIONS,
  TEMPLATE_CATEGORY_OPTIONS,
} from '../contracts.common';

export const CONTRACT_TEMPLATES_CONFIG = defineCrud({
  endpoint: 'contracts/templates',
  uuidField: 'CttUUID',
  pageTitle: 'contracts.templates',
  pageDescription: 'contracts.templatesDescription',
  createTitle: 'contracts.newTemplate',
  editTitle: 'contracts.editTemplate',
  serverSidePagination: true,
  bulkDelete: true,
  initialValues: {
    ContractAccountCtaUUID: '',
    RegDocumentTypeRdtUUID: '',
    code: '',
    name: '',
    category: 'general',
    kind: 'contract',
    signatureLevel: 'advanced',
    termMonths: 12,
    adjustmentIndex: 'IPCA',
    body: '',
    notes: '',
    status: 1,
  },
  ...revisionDeletePayloads('CttUUID', 'CttRevision'),
  listFilters: [{ key: 'accountUUID', label: 'contracts.account', type: 'search-select', span: 1, remoteLookup: CONTRACT_ACCOUNT_LOOKUP }],
  fields: [
    { key: 'revision', source: 'CttRevision', label: 'contracts.revision', hiddenWhen: () => true },
    { key: 'status', source: 'CttStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'accountUUID', source: 'ContractAccountCtaUUID', label: 'contracts.account', type: 'search-select', required: true, span: 1, remoteLookup: CONTRACT_ACCOUNT_LOOKUP },
    { key: 'docTypeUUID', source: 'RegDocumentTypeRdtUUID', label: 'documents.type', type: 'search-select', span: 1, remoteLookup: DOC_TYPE_LOOKUP },
    { key: 'code', source: 'CttCode', label: 'contracts.templateCode', required: true, span: 1 },
    { key: 'name', source: 'CttName', label: 'contracts.templateName', required: true, span: 1 },
    { key: 'category', source: 'CttCategory', label: 'contracts.templateCategory', type: 'select', span: 1, options: TEMPLATE_CATEGORY_OPTIONS },
    { key: 'kind', source: 'CttKind', label: 'contracts.templateKind', type: 'select', span: 1, options: CONTRACT_KIND_OPTIONS },
    { key: 'signatureLevel', source: 'CttSignatureLevel', label: 'contracts.signatureLevel', type: 'select', span: 1, options: SIGNATURE_LEVEL_OPTIONS },
    { key: 'termMonths', source: 'CttDefaultTermMonths', label: 'contracts.termMonths', type: 'number', span: 1 },
    { key: 'adjustmentIndex', source: 'CttAdjustmentIndex', label: 'contracts.adjustmentIndex', type: 'select', span: 1, options: ADJUSTMENT_INDEX_OPTIONS },
    // business-description: markdown template text with placeholders like {{customer_name}}, {{total_value}}.
    { key: 'body', source: 'CttBody', label: 'contracts.templateBody', type: 'textarea', required: true, span: 4 },
    // business-description: internal notes regarding template versioning and guidelines.
    { key: 'notes', source: 'CttNotes', label: 'contracts.templateNotes', type: 'textarea', span: 4 },
  ],
  columns: [
    { id: 'code', field: 'CttCode', label: 'contracts.templateCode', kind: 'identity' },
    { id: 'name', field: 'CttName', label: 'contracts.templateName' },
    { id: 'kind', field: 'CttKind', label: 'contracts.templateKind' },
    { id: 'signatureLevel', field: 'CttSignatureLevel', label: 'contracts.signatureLevel' },
    { id: 'status', field: 'CttStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  standalone: true,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
  selector: 'app-contract-templates',
  imports: CONFIGURABLE_CRUD_IMPORTS,
})
export class ContractTemplatesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  protected readonly templatePageKey = 'contracts.templates';

  constructor() {
    super(CONTRACT_TEMPLATES_CONFIG);
  }
}
