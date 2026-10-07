import { crmPayload, crmLocalDateTime } from '../crm-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { crmActions } from '../crm-actions';
const config = defineCrud({
  endpoint: 'crm/handoffs',
  uuidField: 'ChoUUID',
  pageTitle: 'crm.title.handoffs',
  initialValues: {
    ChoName: '',
    CrmOpportunityCopUUID: '',
    ChoState: 'pending',
    ChoNotes: '',
    ChoStatus: 1,
    AssignedUserUsrUUID: '',
  },
  fields: [
    {
      key: 'ChoName',
      source: 'ChoName',
      label: 'crm.field.Name',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'CrmOpportunityCopUUID',
      source: 'CrmOpportunityCopUUID',
      label: 'crm.title.opportunities',
      span: 1,
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
      key: 'ChoState',
      source: 'ChoState',
      label: 'crm.field.State',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'pending',
          label: 'crm.enum.pending',
        },
        {
          value: 'forwarded',
          label: 'crm.enum.forwarded',
        },
        {
          value: 'accepted',
          label: 'crm.enum.accepted',
        },
      ],
    },
    {
      key: 'ChoNotes',
      source: 'ChoNotes',
      label: 'crm.field.Notes',
      span: 1,
      required: false,
      type: 'textarea',
    },
    {
      key: 'ChoStatus',
      source: 'ChoStatus',
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
      key: 'ChoRevision',
      source: 'ChoRevision',
      label: 'crm.field.Revision',
      hidden: true,
    },
  ],
  columns: [
    {
      id: 'CrmOpportunityCopUUID',
      field: 'CrmOpportunityCopUUIDName',
      label: 'crm.title.opportunities',
      kind: 'text',
    },
    {
      id: 'ChoName',
      field: 'ChoName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'ChoState',
      field: 'ChoState',
      label: 'crm.field.State',
      kind: 'text',
      options: [
        {
          value: 'pending',
          label: 'crm.enum.pending',
        },
        {
          value: 'forwarded',
          label: 'crm.enum.forwarded',
        },
        {
          value: 'accepted',
          label: 'crm.enum.accepted',
        },
      ],
    },
    {
      id: 'ChoStatus',
      field: 'ChoStatus',
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
      key: 'ChoState',
      paramKey: 'ChoState',
      label: 'crm.field.State',
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'pending',
          label: 'crm.enum.pending',
        },
        {
          value: 'forwarded',
          label: 'crm.enum.forwarded',
        },
        {
          value: 'accepted',
          label: 'crm.enum.accepted',
        },
      ],
      span: 1,
    },
  ],
  serverSidePagination: true,
  bulkDelete: false,
  quickCreateLabelField: 'ChoName',
  payload: (values, editing) =>
    crmPayload(values, editing, 'ChoRevision', ['ChoStatus', 'ChoRevision'], []),
  rowActions: crmActions('handoffs'),
});
@Component({
  selector: 'app-crm-handoffs',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmHandoffPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
