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
  OBLIGATION_PARTY_OPTIONS,
  OBLIGATION_RECURRENCE_OPTIONS,
  OBLIGATION_STATUS_OPTIONS,
} from '../contracts.common';

export const CONTRACT_OBLIGATIONS_CONFIG = defineCrud({
  endpoint: 'contracts/obligations',
  uuidField: 'CtoUUID',
  pageTitle: 'contracts.obligations',
  pageDescription: 'contracts.obligationsDescription',
  createTitle: 'contracts.newObligation',
  editTitle: 'contracts.editObligation',
  serverSidePagination: true,
  bulkDelete: true,
  initialValues: {
    documentUuid: '',
    title: '',
    description: '',
    party: 'company',
    dueDate: '',
    recurrence: 'one_time',
    noticeDays: 7,
    status: 'pending',
    notes: '',
  },
  ...revisionDeletePayloads('CtoUUID', 'CtoRevision'),
  listFilters: [
    {
      key: 'status',
      label: 'contracts.obligationStatus',
      type: 'select',
      span: 1,
      options: OBLIGATION_STATUS_OPTIONS,
    },
    {
      key: 'party',
      label: 'contracts.obligationParty',
      type: 'select',
      span: 1,
      options: OBLIGATION_PARTY_OPTIONS,
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
      required: true,
      span: 1,
      remoteLookup: DOCUMENT_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason: 'Contract documents are generated or imported through the document lifecycle workflow, not created from an inline modal.',
    },
    {
      key: 'title',
      source: 'CtoTitle',
      label: 'contracts.obligationTitle',
      type: 'text',
      required: true,
      span: 1,
    },
    {
      key: 'party',
      source: 'CtoParty',
      label: 'contracts.obligationParty',
      type: 'select',
      required: true,
      span: 1,
      options: OBLIGATION_PARTY_OPTIONS,
    },
    {
      key: 'dueDate',
      source: 'CtoDueDate',
      label: 'contracts.dueDate',
      type: 'date',
      required: true,
      span: 1,
    },
    {
      key: 'recurrence',
      source: 'CtoRecurrence',
      label: 'contracts.recurrence',
      type: 'select',
      span: 1,
      options: OBLIGATION_RECURRENCE_OPTIONS,
    },
    {
      key: 'noticeDays',
      source: 'CtoNoticeDays',
      label: 'contracts.noticeDays',
      type: 'number',
      span: 1,
    },
    {
      key: 'status',
      source: 'CtoStatus',
      label: 'contracts.obligationStatus',
      type: 'select',
      span: 1,
      options: OBLIGATION_STATUS_OPTIONS,
    },
    {
      key: 'description',
      source: 'CtoDescription',
      label: 'contracts.description',
      type: 'textarea',
      span: 4,
    },
    {
      key: 'notes',
      source: 'CtoNotes',
      label: 'contracts.notes',
      type: 'textarea',
      span: 4,
    },
  ],
  columns: [
    { id: 'documentNumber', field: 'DocumentNumber', label: 'contracts.documentNumber', kind: 'identity' },
    { id: 'title', field: 'CtoTitle', label: 'contracts.obligationTitle' },
    { id: 'party', field: 'CtoParty', label: 'contracts.obligationParty' },
    { id: 'dueDate', field: 'CtoDueDate', label: 'contracts.dueDate', kind: 'date' },
    { id: 'recurrence', field: 'CtoRecurrence', label: 'contracts.recurrence' },
    { id: 'status', field: 'CtoStatus', label: 'contracts.obligationStatus' },
  ],
});

@Component({
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
  imports: CONFIGURABLE_CRUD_IMPORTS,
  standalone: true,
  selector: 'mns-contracts-obligations',
})
export class ContractsObligationsComponent extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  public readonly defaultObligationParty = 'company';

  constructor() {
    super(CONTRACT_OBLIGATIONS_CONFIG);
  }

  public getObligationBadge(status: string): string {
    switch (status) {
      case 'fulfilled': return 'success';
      case 'breached': return 'danger';
      case 'waived': return 'neutral';
      default: return 'warning';
    }
  }

  public isObligationOverdue(record: ConfigurableCrudRecord): boolean {
    const dueDateStr = String(record['CtoDueDate'] ?? '');
    const status = String(record['CtoStatus'] ?? '');
    if (!dueDateStr || status === 'fulfilled' || status === 'waived') return false;
    return new Date(dueDateStr) < new Date();
  }
}
