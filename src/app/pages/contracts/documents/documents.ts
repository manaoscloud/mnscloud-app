import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import {
  COMPANY_LOOKUP,
  CONTRACT_ACCOUNT_LOOKUP,
  CONTRACT_KIND_OPTIONS,
  CUSTOMER_LOOKUP,
  DOC_TYPE_LOOKUP,
  DOCUMENT_DIRECTION_OPTIONS,
  DOCUMENT_STATE_OPTIONS,
  SIGNATURE_LEVEL_OPTIONS,
  SUPPLIER_LOOKUP,
  TEMPLATE_LOOKUP,
} from '../contracts.common';

export const CONTRACT_DOCUMENTS_CONFIG = defineCrud({
  endpoint: 'contracts/documents',
  uuidField: 'CtdUUID',
  pageTitle: 'contracts.documents',
  pageDescription: 'contracts.documentsDescription',
  createTitle: 'contracts.newDocument',
  editTitle: 'contracts.editDocument',
  serverSidePagination: true,
  bulkDelete: true,
  initialValues: {
    ContractAccountCtaUUID: '',
    ContractTemplateCttUUID: '',
    RegDocumentTypeRdtUUID: '',
    RegCompanyRcoUUID: '',
    RegCustomerRcuUUID: '',
    RegSupplierRsuUUID: '',
    number: '',
    title: '',
    kind: 'contract',
    direction: 'outbound',
    state: 'draft',
    signatureLevel: 'advanced',
    currency: 'BRL',
    totalValue: null,
    recurringValue: null,
    startDate: null,
    endDate: null,
    renewalMode: 'manual',
    noticeDays: 30,
    adjustmentIndex: 'IPCA',
    body: '',
    notes: '',
    status: 1,
  },
  ...revisionDeletePayloads('CtdUUID', 'CtdRevision'),
  listFilters: [{ key: 'accountUUID', label: 'contracts.account', type: 'search-select', span: 1, remoteLookup: CONTRACT_ACCOUNT_LOOKUP }, { key: 'state', label: 'contracts.documentState', type: 'select', span: 1, options: DOCUMENT_STATE_OPTIONS }],
  fields: [
    { key: 'status', source: 'CtdStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'accountUUID', source: 'ContractAccountCtaUUID', label: 'contracts.account', type: 'search-select', required: true, span: 1, remoteLookup: CONTRACT_ACCOUNT_LOOKUP },
    { key: 'title', source: 'CtdTitle', label: 'contracts.documentTitle', required: true, span: 1 },
    { key: 'number', source: 'CtdNumber', label: 'contracts.documentNumber', span: 1 },
    { key: 'templateUUID', source: 'ContractTemplateCttUUID', label: 'contracts.template', type: 'search-select', span: 1, remoteLookup: TEMPLATE_LOOKUP },
    { key: 'docTypeUUID', source: 'RegDocumentTypeRdtUUID', label: 'documents.type', type: 'search-select', span: 1, remoteLookup: DOC_TYPE_LOOKUP },
    { key: 'companyUUID', source: 'RegCompanyRcoUUID', label: 'Company', type: 'search-select', span: 1, remoteLookup: COMPANY_LOOKUP },
    { key: 'customerUUID', source: 'RegCustomerRcuUUID', label: 'Customer', type: 'search-select', span: 1, remoteLookup: CUSTOMER_LOOKUP },
    { key: 'supplierUUID', source: 'RegSupplierRsuUUID', label: 'Supplier', type: 'search-select', span: 1, remoteLookup: SUPPLIER_LOOKUP },
    { key: 'kind', source: 'CtdKind', label: 'contracts.templateKind', type: 'select', span: 1, options: CONTRACT_KIND_OPTIONS },
    { key: 'direction', source: 'CtdDirection', label: 'contracts.documentDirection', type: 'select', span: 1, options: DOCUMENT_DIRECTION_OPTIONS },
    { key: 'state', source: 'CtdState', label: 'contracts.documentState', type: 'select', span: 1, options: DOCUMENT_STATE_OPTIONS },
    { key: 'signatureLevel', source: 'CtdSignatureLevel', label: 'contracts.signatureLevel', type: 'select', span: 1, options: SIGNATURE_LEVEL_OPTIONS },
    { key: 'totalValue', source: 'CtdTotalValue', label: 'contracts.totalValue', type: 'number', span: 1 },
    { key: 'recurringValue', source: 'CtdRecurringValue', label: 'contracts.recurringValue', type: 'number', span: 1 },
    { key: 'startDate', source: 'CtdStartDate', label: 'contracts.startDate', type: 'date', span: 1 },
    { key: 'endDate', source: 'CtdEndDate', label: 'contracts.endDate', type: 'date', span: 1 },
    // business-description: compiled contract text with resolved placeholders.
    { key: 'body', source: 'CtdBody', label: 'contracts.documentBody', type: 'textarea', span: 4 },
    // business-description: internal notes regarding negotiations and legal conditions.
    { key: 'notes', source: 'CtdNotes', label: 'contracts.documentNotes', type: 'textarea', span: 4 },
    { key: 'revision', source: 'CtdRevision', label: 'contracts.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'number', field: 'CtdNumber', label: 'contracts.documentNumber', kind: 'identity' }, { id: 'title', field: 'CtdTitle', label: 'contracts.documentTitle' }, { id: 'state', field: 'CtdState', label: 'contracts.documentState' }, { id: 'totalValue', field: 'CtdTotalValue', label: 'contracts.totalValue' }, { id: 'status', field: 'CtdStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-contract-documents',
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
  imports: CONFIGURABLE_CRUD_IMPORTS,
  standalone: true,
})
export class ContractDocumentsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(CONTRACT_DOCUMENTS_CONFIG);
  }
}
