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
  endpoint: 'crm/accounts',
  uuidField: 'CacUUID',
  pageTitle: 'crm.title.accounts',
  initialValues: {
    CacName: '',
    CacType: 'company',
    CacDocument: '',
    CrmIndustryCinUUID: '',
    CacOccupation: '',
    CacCity: '',
    CacState: '',
    CacNotes: '',
    CacStatus: 1,
    AssignedUserUsrUUID: '',
  },
  fields: [
    {
      key: 'CacName',
      source: 'CacName',
      label: 'crm.field.Name',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'CacType',
      source: 'CacType',
      label: 'crm.field.Type',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'company',
          label: 'crm.enum.company',
        },
        {
          value: 'person',
          label: 'crm.enum.person',
        },
      ],
    },
    {
      key: 'CacDocument',
      source: 'CacDocument',
      label: 'crm.field.Document',
      span: 1,
      required: false,
      type: 'text',
    },
    {
      key: 'CrmIndustryCinUUID',
      source: 'CrmIndustryCinUUID',
      label: 'crm.title.industries',
      span: 1,
      required: false,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'crm/industries',
        uuidField: 'CinUUID',
        labelField: 'CinName',
        selectedLabelField: 'CrmIndustryCinUUIDName',
      },
    },
    {
      key: 'CacOccupation',
      source: 'CacOccupation',
      label: 'crm.field.Occupation',
      span: 1,
      required: false,
      type: 'text',
    },
    {
      key: 'CacCity',
      source: 'CacCity',
      label: 'crm.field.City',
      span: 1,
      required: false,
      type: 'text',
    },
    {
      key: 'CacState',
      source: 'CacState',
      label: 'crm.field.State',
      span: 1,
      required: false,
      type: 'text',
    },
    {
      key: 'CacNotes',
      source: 'CacNotes',
      label: 'crm.field.Notes',
      span: 1,
      required: false,
      type: 'textarea',
    },
    {
      key: 'CacStatus',
      source: 'CacStatus',
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
      key: 'CacRevision',
      source: 'CacRevision',
      label: 'crm.field.Revision',
      hidden: true,
    },
  ],
  columns: [
    {
      id: 'CrmIndustryCinUUID',
      field: 'CrmIndustryCinUUIDName',
      label: 'crm.title.industries',
      kind: 'text',
    },
    {
      id: 'CacName',
      field: 'CacName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'CacDocument',
      field: 'CacDocument',
      label: 'crm.field.Document',
      kind: 'text',
    },
    {
      id: 'CacState',
      field: 'CacState',
      label: 'crm.field.State',
      kind: 'text',
    },
    {
      id: 'CacStatus',
      field: 'CacStatus',
      label: 'crm.field.Status',
      kind: 'status',
    },
  ],
  listFilters: [
    {
      key: 'CrmIndustryCinUUID',
      paramKey: 'CrmIndustryCinUUID',
      label: 'crm.title.industries',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'crm/industries', uuidField: 'CinUUID', labelField: 'CinName' },
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
      key: 'CacType',
      paramKey: 'CacType',
      label: 'crm.field.Type',
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'company',
          label: 'crm.enum.company',
        },
        {
          value: 'person',
          label: 'crm.enum.person',
        },
      ],
      span: 1,
    },
  ],
  serverSidePagination: true,
  bulkDelete: false,
  quickCreateLabelField: 'CacName',
  payload: (values, editing) =>
    crmPayload(values, editing, 'CacRevision', ['CacStatus', 'CacRevision'], []),
  rowActions: crmActions('accounts'),
});
@Component({
  selector: 'app-crm-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmAccountPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
