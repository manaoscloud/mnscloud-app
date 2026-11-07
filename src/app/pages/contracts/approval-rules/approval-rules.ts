import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import {
  CONTRACT_ACCOUNT_LOOKUP,
  CONTRACT_KIND_OPTIONS,
} from '../contracts.common';

export const CONTRACT_APPROVAL_RULES_CONFIG = defineCrud({
  endpoint: 'contracts/approval-rules',
  uuidField: 'CtrUUID',
  pageTitle: 'contracts.approvalRules',
  pageDescription: 'contracts.approvalRulesDescription',
  createTitle: 'contracts.newApprovalRule',
  editTitle: 'contracts.editApprovalRule',
  serverSidePagination: true,
  bulkDelete: true,
  initialValues: {
    accountUuid: '',
    name: '',
    documentKind: 'contract',
    minTotalValue: null,
    role: '',
    stepOrder: 1,
    status: 1,
  },
  ...revisionDeletePayloads('CtrUUID', 'CtrRevision'),
  listFilters: [
    {
      key: 'documentKind',
      label: 'contracts.documentKind',
      type: 'select',
      span: 1,
      options: CONTRACT_KIND_OPTIONS,
    },
    {
      key: 'accountUuid',
      label: 'contracts.account',
      type: 'search-select',
      span: 1,
      remoteLookup: CONTRACT_ACCOUNT_LOOKUP,
    },
  ],
  fields: [
    {
      key: 'accountUuid',
      source: 'ContractAccountCtaUUID',
      label: 'contracts.account',
      type: 'search-select',
      required: true,
      span: 1,
      remoteLookup: CONTRACT_ACCOUNT_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason: 'Contract accounts are provisioned via account setup.',
    },
    {
      key: 'name',
      source: 'CtrName',
      label: 'contracts.ruleName',
      type: 'text',
      required: true,
      span: 1,
    },
    {
      key: 'documentKind',
      source: 'CtrDocumentKind',
      label: 'contracts.documentKind',
      type: 'select',
      span: 1,
      options: CONTRACT_KIND_OPTIONS,
    },
    {
      key: 'minTotalValue',
      source: 'CtrMinTotalValue',
      label: 'contracts.minTotalValue',
      type: 'number',
      span: 1,
    },
    {
      key: 'role',
      source: 'CtrRole',
      label: 'contracts.approverRole',
      type: 'text',
      span: 1,
    },
    {
      key: 'stepOrder',
      source: 'CtrStepOrder',
      label: 'contracts.stepOrder',
      type: 'number',
      span: 1,
    },
  ],
  columns: [
    {
      id: 'ruleId',
      field: 'CtrID',
      label: 'contracts.ruleId',
      kind: 'identity',
    },
    {
      id: 'name',
      field: 'CtrName',
      label: 'contracts.ruleName',
    },
    {
      id: 'documentKind',
      field: 'CtrDocumentKind',
      label: 'contracts.documentKind',
    },
    {
      id: 'minTotalValue',
      field: 'CtrMinTotalValue',
      label: 'contracts.minTotalValue',
      kind: 'currency',
    },
    {
      id: 'role',
      field: 'CtrRole',
      label: 'contracts.approverRole',
    },
    {
      id: 'stepOrder',
      field: 'CtrStepOrder',
      label: 'contracts.stepOrder',
    },
    {
      id: 'dateCreated',
      field: 'CtrDateCreated',
      label: 'contracts.dateCreated',
    },
  ],
});

@Component({
  selector: 'mns-contracts-approval-rules',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ContractsApprovalRulesComponent extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(CONTRACT_APPROVAL_RULES_CONFIG);
  }

  public getRuleSummary(record: ConfigurableCrudRecord): string {
    const role = String(record['CtrRole'] ?? 'Responsavel');
    const step = Number(record['CtrStepOrder'] ?? 1);
    return `${role} (Etapa ${step})`;
  }
}
