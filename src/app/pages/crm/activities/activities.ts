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
  endpoint: 'crm/activities',
  uuidField: 'CatUUID',
  pageTitle: 'crm.title.activities',
  initialValues: {
    CatName: '',
    CrmLeadCleUUID: '',
    CrmOpportunityCopUUID: '',
    CatKind: 'task',
    CatDueAt: '',
    CatState: 'planned',
    CatNotes: '',
    CatStatus: 1,
    AssignedUserUsrUUID: '',
  },
  fields: [
    {
      key: 'CatName',
      source: 'CatName',
      label: 'crm.field.Name',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'CrmLeadCleUUID',
      source: 'CrmLeadCleUUID',
      label: 'crm.title.leads',
      span: 1,
      required: false,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'crm/leads',
        uuidField: 'CleUUID',
        labelField: 'CleName',
        selectedLabelField: 'CrmLeadCleUUIDName',
      },
    },
    {
      key: 'CrmOpportunityCopUUID',
      source: 'CrmOpportunityCopUUID',
      label: 'crm.title.opportunities',
      span: 1,
      required: false,
      type: 'search-select',
      remoteLookup: {
        selectedLabelField: 'CrmOpportunityCopUUIDName',
        endpoint: 'crm/opportunities',
        uuidField: 'CopUUID',
        labelField: 'CopName',
      },
    },
    {
      key: 'CatKind',
      source: 'CatKind',
      label: 'crm.field.Kind',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'task',
          label: 'crm.enum.task',
        },
        {
          value: 'call',
          label: 'crm.enum.call',
        },
        {
          value: 'meeting',
          label: 'crm.enum.meeting',
        },
        {
          value: 'email',
          label: 'crm.enum.email',
        },
      ],
    },
    {
      key: 'CatDueAt',
      source: 'CatDueAt',
      label: 'crm.field.DueAt',
      span: 1,
      required: true,
      type: 'datetime',
      fromRecord: crmLocalDateTime,
    },
    {
      key: 'CatState',
      source: 'CatState',
      label: 'crm.field.State',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'planned',
          label: 'crm.enum.planned',
        },
        {
          value: 'done',
          label: 'crm.enum.done',
        },
        {
          value: 'cancelled',
          label: 'crm.enum.cancelled',
        },
      ],
    },
    {
      key: 'CatNotes',
      source: 'CatNotes',
      label: 'crm.field.Notes',
      span: 1,
      required: false,
      type: 'textarea',
    },
    {
      key: 'CatStatus',
      source: 'CatStatus',
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
      key: 'CatRevision',
      source: 'CatRevision',
      label: 'crm.field.Revision',
      hidden: true,
    },
  ],
  columns: [
    { id: 'CrmLeadCleUUID', field: 'CrmLeadCleUUIDName', label: 'crm.title.leads', kind: 'text' },
    {
      id: 'CrmOpportunityCopUUID',
      field: 'CrmOpportunityCopUUIDName',
      label: 'crm.title.opportunities',
      kind: 'text',
    },
    {
      id: 'CatName',
      field: 'CatName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'CatKind',
      field: 'CatKind',
      label: 'crm.field.Kind',
      kind: 'text',
      options: [
        {
          value: 'task',
          label: 'crm.enum.task',
        },
        {
          value: 'call',
          label: 'crm.enum.call',
        },
        {
          value: 'meeting',
          label: 'crm.enum.meeting',
        },
        {
          value: 'email',
          label: 'crm.enum.email',
        },
      ],
    },
    {
      id: 'CatDueAt',
      field: 'CatDueAt',
      label: 'crm.field.DueAt',
      kind: 'datetime',
    },
    {
      id: 'CatState',
      field: 'CatState',
      label: 'crm.field.State',
      kind: 'text',
      options: [
        {
          value: 'planned',
          label: 'crm.enum.planned',
        },
        {
          value: 'done',
          label: 'crm.enum.done',
        },
        {
          value: 'cancelled',
          label: 'crm.enum.cancelled',
        },
      ],
    },
    {
      id: 'CatStatus',
      field: 'CatStatus',
      label: 'crm.field.Status',
      kind: 'status',
    },
  ],
  listFilters: [
    {
      key: 'CrmLeadCleUUID',
      paramKey: 'CrmLeadCleUUID',
      label: 'crm.title.leads',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'crm/leads', uuidField: 'CleUUID', labelField: 'CleName' },
    },
    {
      key: 'CrmOpportunityCopUUID',
      paramKey: 'CrmOpportunityCopUUID',
      label: 'crm.title.opportunities',
      type: 'search-select',
      span: 1,
      remoteLookup: {
        selectedLabelField: 'CrmOpportunityCopUUIDName',
        endpoint: 'crm/opportunities',
        uuidField: 'CopUUID',
        labelField: 'CopName',
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
      key: 'CatKind',
      paramKey: 'CatKind',
      label: 'crm.field.Kind',
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'task',
          label: 'crm.enum.task',
        },
        {
          value: 'call',
          label: 'crm.enum.call',
        },
        {
          value: 'meeting',
          label: 'crm.enum.meeting',
        },
        {
          value: 'email',
          label: 'crm.enum.email',
        },
      ],
      span: 1,
    },
    {
      key: 'CatState',
      paramKey: 'CatState',
      label: 'crm.field.State',
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'planned',
          label: 'crm.enum.planned',
        },
        {
          value: 'done',
          label: 'crm.enum.done',
        },
        {
          value: 'cancelled',
          label: 'crm.enum.cancelled',
        },
      ],
      span: 1,
    },
  ],
  serverSidePagination: true,
  bulkDelete: false,
  quickCreateLabelField: 'CatName',
  payload: (values, editing) =>
    crmPayload(values, editing, 'CatRevision', ['CatStatus', 'CatRevision'], ['CatDueAt']),
  rowActions: crmActions('activities'),
});
@Component({
  selector: 'app-crm-activities',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmActivityPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
