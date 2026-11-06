import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import {
  CLAUSE_CATEGORY_OPTIONS,
  CONTRACT_ACCOUNT_LOOKUP,
  LANGUAGE_OPTIONS,
  RISK_LEVEL_OPTIONS,
} from '../contracts.common';

export const CONTRACT_CLAUSES_CONFIG = defineCrud({
  endpoint: 'contracts/clauses',
  uuidField: 'CtcUUID',
  pageTitle: 'contracts.clauses',
  pageDescription: 'contracts.clausesDescription',
  createTitle: 'contracts.newClause',
  editTitle: 'contracts.editClause',
  serverSidePagination: true,
  bulkDelete: true,
  initialValues: {
    ContractAccountCtaUUID: '',
    code: '',
    title: '',
    category: 'general',
    language: 'pt-BR',
    riskLevel: 'standard',
    content: '',
    notes: '',
    status: 1,
  },
  ...revisionDeletePayloads('CtcUUID', 'CtcRevision'),
  listFilters: [{ key: 'accountUUID', label: 'contracts.account', type: 'search-select', span: 1, remoteLookup: CONTRACT_ACCOUNT_LOOKUP }],
  fields: [
    { key: 'status', source: 'CtcStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'accountUUID', source: 'ContractAccountCtaUUID', label: 'contracts.account', type: 'search-select', required: true, span: 1, remoteLookup: CONTRACT_ACCOUNT_LOOKUP },
    { key: 'code', source: 'CtcCode', label: 'contracts.clauseCode', required: true, span: 1 },
    { key: 'title', source: 'CtcTitle', label: 'contracts.clauseTitle', required: true, span: 1 },
    { key: 'category', source: 'CtcCategory', label: 'contracts.clauseCategory', type: 'select', span: 1, options: CLAUSE_CATEGORY_OPTIONS },
    { key: 'language', source: 'CtcLanguage', label: 'contracts.clauseLanguage', type: 'select', span: 1, options: LANGUAGE_OPTIONS },
    { key: 'riskLevel', source: 'CtcRiskLevel', label: 'contracts.clauseRiskLevel', type: 'select', span: 1, options: RISK_LEVEL_OPTIONS },
    // business-description: full legal body text of the clause.
    { key: 'content', source: 'CtcContent', label: 'contracts.clauseContent', type: 'textarea', required: true, span: 4 },
    // business-description: internal guidance notes on when to include or adjust this clause.
    { key: 'notes', source: 'CtcNotes', label: 'contracts.clauseNotes', type: 'textarea', span: 4 },
    { key: 'revision', source: 'CtcRevision', label: 'contracts.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'code', field: 'CtcCode', label: 'contracts.clauseCode', kind: 'identity' }, { id: 'title', field: 'CtcTitle', label: 'contracts.clauseTitle' }, { id: 'category', field: 'CtcCategory', label: 'contracts.clauseCategory' }, { id: 'riskLevel', field: 'CtcRiskLevel', label: 'contracts.clauseRiskLevel' }, { id: 'status', field: 'CtcStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-contract-clauses',
  imports: CONFIGURABLE_CRUD_IMPORTS,
  standalone: true,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ContractClausesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  protected readonly clausePageKey = 'contracts.clauses';

  constructor() {
    super(CONTRACT_CLAUSES_CONFIG);
  }
}
