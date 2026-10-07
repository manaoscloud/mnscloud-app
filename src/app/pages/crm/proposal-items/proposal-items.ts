import { crmPayload, crmLocalDateTime } from '../crm-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
export const config = defineCrud({
  endpoint: 'crm/proposal-items',
  uuidField: 'CptUUID',
  pageTitle: 'crm.title.proposal-items',
  initialValues: {
    CptName: '',
    CrmProposalCppUUID: '',
    CrmProductCprUUID: '',
    CptQuantity: 1,
    CptUnitAmount: 0,
    CptDiscountPercent: 0,
    CptPeriod: 'monthly',
    CptStatus: 1,
    AssignedUserUsrUUID: '',
  },
  fields: [
    {
      key: 'CptName',
      source: 'CptName',
      label: 'crm.field.Name',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'CrmProposalCppUUID',
      source: 'CrmProposalCppUUID',
      label: 'crm.title.proposals',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'crm/proposals',
        uuidField: 'CppUUID',
        labelField: 'CppName',
        selectedLabelField: 'CrmProposalCppUUIDName',
      },
    },
    {
      key: 'CrmProductCprUUID',
      source: 'CrmProductCprUUID',
      label: 'crm.title.products',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        selectedLabelField: 'CrmProductCprUUIDName',
        endpoint: 'crm/products',
        uuidField: 'CprUUID',
        labelField: 'CprName',
      },
    },
    {
      key: 'CptQuantity',
      source: 'CptQuantity',
      label: 'crm.field.Quantity',
      span: 1,
      required: true,
      type: 'number',
    },
    {
      key: 'CptUnitAmount',
      source: 'CptUnitAmount',
      label: 'crm.field.UnitAmount',
      span: 1,
      required: true,
      type: 'number',
    },
    {
      key: 'CptDiscountPercent',
      source: 'CptDiscountPercent',
      label: 'crm.field.DiscountPercent',
      span: 1,
      required: true,
      type: 'number',
    },
    {
      key: 'CptPeriod',
      source: 'CptPeriod',
      label: 'crm.field.Period',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'once',
          label: 'crm.enum.once',
        },
        {
          value: 'monthly',
          label: 'crm.enum.monthly',
        },
        {
          value: 'yearly',
          label: 'crm.enum.yearly',
        },
      ],
    },
    {
      key: 'CptStatus',
      source: 'CptStatus',
      label: 'crm.field.Status',
      span: 1,
      required: true,
      type: 'status',
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
      key: 'CptRevision',
      source: 'CptRevision',
      label: 'crm.field.Revision',
      hidden: true,
    },
  ],
  columns: [
    {
      id: 'CrmProposalCppUUID',
      field: 'CrmProposalCppUUIDName',
      label: 'crm.title.proposals',
      kind: 'text',
    },
    {
      id: 'CrmProductCprUUID',
      field: 'CrmProductCprUUIDName',
      label: 'crm.title.products',
      kind: 'text',
    },
    {
      id: 'CptName',
      field: 'CptName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'CptPeriod',
      field: 'CptPeriod',
      label: 'crm.field.Period',
      kind: 'text',
      options: [
        {
          value: 'once',
          label: 'crm.enum.once',
        },
        {
          value: 'monthly',
          label: 'crm.enum.monthly',
        },
        {
          value: 'yearly',
          label: 'crm.enum.yearly',
        },
      ],
    },
    {
      id: 'CptStatus',
      field: 'CptStatus',
      label: 'crm.field.Status',
      kind: 'status',
    },
  ],
  listFilters: [
    {
      key: 'CrmProposalCppUUID',
      paramKey: 'CrmProposalCppUUID',
      label: 'crm.title.proposals',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'crm/proposals', uuidField: 'CppUUID', labelField: 'CppName' },
    },
    {
      key: 'CrmProductCprUUID',
      paramKey: 'CrmProductCprUUID',
      label: 'crm.title.products',
      type: 'search-select',
      span: 1,
      remoteLookup: {
        selectedLabelField: 'CrmProductCprUUIDName',
        endpoint: 'crm/products',
        uuidField: 'CprUUID',
        labelField: 'CprName',
      },
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
      key: 'CptPeriod',
      paramKey: 'CptPeriod',
      label: 'crm.field.Period',
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'once',
          label: 'crm.enum.once',
        },
        {
          value: 'monthly',
          label: 'crm.enum.monthly',
        },
        {
          value: 'yearly',
          label: 'crm.enum.yearly',
        },
      ],
      span: 1,
    },
  ],
  serverSidePagination: true,
  bulkDelete: false,
  quickCreateLabelField: 'CptName',
  payload: (values, editing) =>
    crmPayload(
      values,
      editing,
      'CptRevision',
      ['CptQuantity', 'CptUnitAmount', 'CptDiscountPercent', 'CptStatus', 'CptRevision'],
      [],
    ),
});
@Component({
  selector: 'app-crm-proposal-items',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmProposalItemPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
