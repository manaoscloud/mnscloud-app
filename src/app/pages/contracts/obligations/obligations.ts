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
      label: 'contracts.document',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: DOCUMENT_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason: 'Contract documents are generated or imported through the document lifecycle workflow, not created from an inline modal.',
      source: 'ContractDocumentCtdUUID',
      key: 'documentUuid',
    },
    {
      label: 'contracts.obligationTitle',
      span: 1,
      required: true,
      type: 'text',
      source: 'CtoTitle',
      key: 'title',
    },
    {
      label: 'contracts.obligationParty',
      span: 1,
      required: true,
      type: 'select',
      options: OBLIGATION_PARTY_OPTIONS,
      source: 'CtoParty',
      key: 'party',
    },
    {
      label: 'contracts.dueDate',
      span: 1,
      required: true,
      type: 'date',
      source: 'CtoDueDate',
      key: 'dueDate',
    },
    {
      label: 'contracts.recurrence',
      span: 1,
      type: 'select',
      options: OBLIGATION_RECURRENCE_OPTIONS,
      source: 'CtoRecurrence',
      key: 'recurrence',
    },
    {
      label: 'contracts.noticeDays',
      span: 1,
      type: 'number',
      source: 'CtoNoticeDays',
      key: 'noticeDays',
    },
    {
      label: 'contracts.obligationStatus',
      span: 1,
      type: 'select',
      options: OBLIGATION_STATUS_OPTIONS,
      source: 'CtoStatus',
      key: 'status',
    },
    {
      label: 'contracts.description',
      span: 4,
      type: 'textarea',
      source: 'CtoDescription',
      key: 'description',
    },
    {
      label: 'contracts.notes',
      span: 4,
      type: 'textarea',
      source: 'CtoNotes',
      key: 'notes',
    },
  ],
  columns: [
    Object.freeze({ id: 'documentNumber', label: 'contracts.documentNumber', field: 'DocumentNumber', kind: 'identity' as const }),
    Object.freeze({ id: 'title', label: 'contracts.obligationTitle', field: 'CtoTitle' }),
    Object.freeze({ id: 'party', label: 'contracts.obligationParty', field: 'CtoParty' }),
    Object.freeze({ id: 'dueDate', label: 'contracts.dueDate', field: 'CtoDueDate', kind: 'date' as const }),
    Object.freeze({ id: 'recurrence', label: 'contracts.recurrence', field: 'CtoRecurrence' }),
    Object.freeze({ id: 'status', label: 'contracts.obligationStatus', field: 'CtoStatus' }),
  ],
});

@Component({
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
  standalone: true,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  selector: 'mns-contracts-obligations',
  imports: CONFIGURABLE_CRUD_IMPORTS,
})
export class ContractsObligationsComponent extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  public readonly defaultObligationParty = 'company';
  public readonly fulfilledStatus = 'fulfilled';
  public readonly waivedStatus = 'waived';

  constructor() {
    super(CONTRACT_OBLIGATIONS_CONFIG);
  }

  public getObligationBadge(status: string): string {
    switch (status) {
      case this.fulfilledStatus: return 'success';
      case 'breached': return 'danger';
      case this.waivedStatus: return 'neutral';
      default: return 'warning';
    }
  }

  public isObligationOverdue(record: ConfigurableCrudRecord): boolean {
    const dueDateStr = String(record['CtoDueDate'] ?? '');
    const status = String(record['CtoStatus'] ?? '');
    if (!dueDateStr || status === this.fulfilledStatus || status === this.waivedStatus) return false;
    return new Date(dueDateStr) < new Date();
  }

  public getPartyLabel(party: string): string {
    return party === this.defaultObligationParty ? 'Empresa' : party;
  }
}
