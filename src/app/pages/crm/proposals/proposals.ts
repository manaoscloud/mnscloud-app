import { CRM_OPTIONS } from '../crm-options';
import { crmPayload } from '../crm-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { crmActions } from '../crm-actions';
const config = defineCrud({
  endpoint: 'crm/proposals',
  uuidField: 'CppUUID',
  pageTitle: 'crm.title.proposals',
  defaultCurrencyFields: ['CppCurrency'],
  initialValues: {
    CppName: '',
    CrmOpportunityCopUUID: '',
    CppVersion: 1,
    CppState: 'draft',
    CppValidUntil: '',
    CppCurrency: '',
    CppTerms: '',
    CppEvidence: '',
    CppStatus: 1,
    AssignedUserUsrUUID: '',
  },
  fields: [
    {
      key: 'CppStatus',
      source: 'CppStatus',
      label: 'crm.field.Status',
      span: 1,
      required: true,
      type: 'status',
    },
    {
      key: 'CppState',
      source: 'CppState',
      label: 'crm.field.State',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: CRM_OPTIONS.proposalStates,
    },
    {
      key: 'CppVersion',
      source: 'CppVersion',
      label: 'crm.field.Version',
      span: 1,
      required: true,
      type: 'number',
    },
    {
      key: 'AssignedUserUsrUUID',
      source: 'AssignedUserUsrUUID',
      label: 'crm.field.AssignedUserUsrUUID',
      span: 1,
      required: false,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'crm/members',
        uuidField: 'UsrUUID',
        labelField: 'UsrName',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'Assignment selects existing tenant members; membership is managed through the canonical tenant invitation flow.',
    },
    {
      key: 'CppName',
      source: 'CppName',
      label: 'crm.field.Name',
      span: 2,
      required: true,
      type: 'text',
    },
    {
      key: 'CrmOpportunityCopUUID',
      source: 'CrmOpportunityCopUUID',
      label: 'crm.title.opportunities',
      span: 2,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'crm/opportunities',
        uuidField: 'CopUUID',
        labelField: 'CopName',
        selectedLabelField: 'CrmOpportunityCopUUIDName',
      },
    },
    {
      key: 'CppValidUntil',
      source: 'CppValidUntil',
      label: 'crm.field.ValidUntil',
      span: 1,
      required: true,
      type: 'date',
      tab: 'financial',
    },
    {
      key: 'CppCurrency',
      source: 'CppCurrency',
      label: 'crm.field.Currency',
      span: 1,
      required: false,
      type: 'text',
      tab: 'financial',
    },
    {
      key: 'CppTerms',
      source: 'CppTerms',
      label: 'crm.field.Terms',
      span: 4,
      required: false,
      type: 'textarea',
      rows: 4,
      breakBefore: true,
      tab: 'financial',
    },
    {
      key: 'CppEvidence',
      source: 'CppEvidence',
      label: 'crm.field.Evidence',
      span: 4,
      required: false,
      type: 'textarea',
      rows: 4,
      breakBefore: true,
      tab: 'financial',
    },
    { key: 'CppRevision', source: 'CppRevision', label: 'crm.field.Revision', hidden: true },
  ],
  columns: [
    {
      id: 'CrmOpportunityCopUUID',
      field: 'CrmOpportunityCopUUIDName',
      label: 'crm.title.opportunities',
      kind: 'text',
    },
    {
      id: 'CppName',
      field: 'CppName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'CppVersion',
      field: 'CppVersion',
      label: 'crm.field.Version',
      kind: 'text',
    },
    {
      id: 'CppState',
      field: 'CppState',
      label: 'crm.field.State',
      kind: 'text',
      options: CRM_OPTIONS.proposalStates,
    },
    {
      id: 'CppValidUntil',
      field: 'CppValidUntil',
      label: 'crm.field.ValidUntil',
      kind: 'date',
    },
    {
      id: 'CppStatus',
      field: 'CppStatus',
      label: 'crm.field.Status',
      kind: 'status',
    },
  ],
  listFilters: [
    {
      key: 'CrmOpportunityCopUUID',
      paramKey: 'CrmOpportunityCopUUID',
      label: 'crm.title.opportunities',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'crm/opportunities', uuidField: 'CopUUID', labelField: 'CopName' },
    },
    {
      key: 'AssignedUserUsrUUID',
      paramKey: 'AssignedUserUsrUUID',
      label: 'crm.field.AssignedUserUsrUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'crm/members', uuidField: 'UsrUUID', labelField: 'UsrName' },
    },
    {
      key: 'CppState',
      paramKey: 'CppState',
      label: 'crm.field.State',
      type: 'select',
      translateOptions: true,
      options: CRM_OPTIONS.proposalStates,
      span: 1,
    },
  ],
  serverSidePagination: true,
  // CRM deletion is individually audited; see app.md, CRM form baseline.
  bulkDelete: false,
  canEditRow: (row) => row['CppState'] === 'draft',
  canDeleteRow: (row) => row['CppState'] === 'draft',
  quickCreateLabelField: 'CppName',
  payload: (values, editing) =>
    crmPayload(values, editing, 'CppRevision', ['CppVersion', 'CppStatus', 'CppRevision'], []),
  rowActions: crmActions('proposals'),
});
@Component({
  selector: 'app-crm-proposals',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmProposalPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
  override async handleRowAction(
    action: import('../../../shared/crud/configurable-crud/configurable-crud-page-base').ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ) {
    if (action.key !== 'document') return;
    try {
      const response = await this.api.post<{ data: { CpdUUID: string } }>(
        `crm/proposals/${row['CppUUID']}/document`,
        {},
      );
      const blob = await this.api.getBlob(`crm/documents/${response.data.CpdUUID}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `proposal-v${row['CppVersion']}.html`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.snack.error(this.transloco.translate('crm.failed'));
    }
  }
}
