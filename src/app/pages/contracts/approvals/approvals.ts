import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  APPROVAL_STATUS_OPTIONS,
  DOCUMENT_LOOKUP,
} from '../contracts.common';

export const CONTRACT_APPROVALS_CONFIG = defineCrud({
  endpoint: 'contracts/approvals',
  uuidField: 'CtfUUID',
  pageTitle: 'contracts.approvals',
  pageDescription: 'contracts.approvalsDescription',
  serverSidePagination: true,
  canCreate: false,
  canDelete: false,
  canEdit: false,
  listFilters: [
    {
      key: 'status',
      label: 'contracts.approvalStatus',
      type: 'select',
      span: 1,
      options: APPROVAL_STATUS_OPTIONS,
    },
    {
      key: 'documentUuid',
      label: 'contracts.document',
      type: 'search-select',
      span: 1,
      remoteLookup: DOCUMENT_LOOKUP,
    },
  ],
  fields: [
    {
      key: 'documentUuid',
      source: 'ContractDocumentCtdUUID',
      label: 'contracts.document',
      type: 'search-select',
      span: 1,
      remoteLookup: DOCUMENT_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason: 'Contract documents are generated or imported through the document lifecycle workflow, not created from an inline modal.',
      disabledWhen: () => true,
    },
    {
      key: 'role',
      source: 'CtfRole',
      label: 'contracts.approverRole',
      type: 'text',
      span: 1,
      disabledWhen: () => true,
    },
    {
      key: 'status',
      source: 'CtfStatus',
      label: 'contracts.approvalStatus',
      type: 'select',
      span: 1,
      options: APPROVAL_STATUS_OPTIONS,
      disabledWhen: () => true,
    },
    {
      key: 'decisionNotes',
      source: 'CtfDecisionNotes',
      label: 'contracts.decisionNotes',
      type: 'textarea',
      span: 4,
    },
    {
      key: 'revision',
      source: 'CtfRevision',
      label: 'contracts.revision',
      hiddenWhen: () => true,
    },
  ],
  columns: [
    { id: 'documentNumber', field: 'DocumentNumber', label: 'contracts.documentNumber', kind: 'identity' },
    { id: 'documentTitle', field: 'DocumentTitle', label: 'contracts.document' },
    { id: 'documentTotalValue', field: 'DocumentTotalValue', label: 'contracts.totalValue', kind: 'currency' },
    { id: 'stepOrder', field: 'CtfStepOrder', label: 'contracts.stepOrder' },
    { id: 'role', field: 'CtfRole', label: 'contracts.approverRole' },
    { id: 'status', field: 'CtfStatus', label: 'contracts.approvalStatus' },
    { id: 'decisionNotes', field: 'CtfDecisionNotes', label: 'contracts.decisionNotes' },
    { id: 'dateDecided', field: 'CtfDateDecided', label: 'contracts.dateDecided' },
  ],
});

@Component({
  imports: CONFIGURABLE_CRUD_IMPORTS,
  selector: 'mns-contracts-approvals',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  standalone: true,
})
export class ContractsApprovalsComponent extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  public readonly pendingStatus = 'pending';
  public readonly defaultDecisionLabel = 'Aprovação';

  constructor() {
    super(CONTRACT_APPROVALS_CONFIG);
  }

  public isDecisionPending(record: ConfigurableCrudRecord): boolean {
    return String(record['CtfStatus'] ?? '') === this.pendingStatus;
  }

  public getApprovalDecisionColor(record: ConfigurableCrudRecord): string {
    const status = String(record['CtfStatus'] ?? '');
    if (status === 'approved') return 'var(--mns-success-color, green)';
    if (status === 'rejected') return 'var(--mns-danger-color, red)';
    return 'var(--mns-warning-color, orange)';
  }

  public canDecide(record: ConfigurableCrudRecord): boolean {
    return this.isDecisionPending(record);
  }
}
