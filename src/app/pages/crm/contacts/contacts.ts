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
  endpoint: 'crm/contacts',
  uuidField: 'CcoUUID',
  pageTitle: 'crm.title.contacts',
  initialValues: {
    CcoName: '',
    CrmAccountCacUUID: '',
    CcoEmail: '',
    CcoPhone: '',
    CcoPosition: '',
    CcoContactPreference: 'not_recorded',
    CcoPreferenceEvidence: '',
    CcoStatus: 1,
    AssignedUserUsrUUID: '',
  },
  fields: [
    {
      key: 'CcoName',
      source: 'CcoName',
      label: 'crm.field.Name',
      span: 1,
      required: true,
      type: 'text',
    },
    {
      key: 'CrmAccountCacUUID',
      source: 'CrmAccountCacUUID',
      label: 'crm.title.accounts',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'crm/accounts',
        uuidField: 'CacUUID',
        labelField: 'CacName',
        selectedLabelField: 'CrmAccountCacUUIDName',
      },
    },
    {
      key: 'CcoEmail',
      source: 'CcoEmail',
      label: 'crm.field.Email',
      span: 1,
      required: false,
      type: 'email',
    },
    {
      key: 'CcoPhone',
      source: 'CcoPhone',
      label: 'crm.field.Phone',
      span: 1,
      required: false,
      type: 'text',
    },
    {
      key: 'CcoPosition',
      source: 'CcoPosition',
      label: 'crm.field.Position',
      span: 1,
      required: false,
      type: 'text',
    },
    {
      key: 'CcoContactPreference',
      source: 'CcoContactPreference',
      label: 'crm.field.ContactPreference',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'not_recorded',
          label: 'crm.enum.not_recorded',
        },
        {
          value: 'email',
          label: 'crm.enum.email',
        },
        {
          value: 'phone',
          label: 'crm.enum.phone',
        },
        {
          value: 'both',
          label: 'crm.enum.both',
        },
        {
          value: 'blocked',
          label: 'crm.enum.blocked',
        },
      ],
    },
    {
      key: 'CcoPreferenceEvidence',
      source: 'CcoPreferenceEvidence',
      label: 'crm.field.PreferenceEvidence',
      span: 1,
      required: false,
      type: 'textarea',
    },
    {
      key: 'CcoStatus',
      source: 'CcoStatus',
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
      key: 'CcoRevision',
      source: 'CcoRevision',
      label: 'crm.field.Revision',
      hidden: true,
    },
  ],
  columns: [
    {
      id: 'CrmAccountCacUUID',
      field: 'CrmAccountCacUUIDName',
      label: 'crm.title.accounts',
      kind: 'text',
    },
    {
      id: 'CcoName',
      field: 'CcoName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'CcoEmail',
      field: 'CcoEmail',
      label: 'crm.field.Email',
      kind: 'text',
    },
    {
      id: 'CcoStatus',
      field: 'CcoStatus',
      label: 'crm.field.Status',
      kind: 'status',
    },
  ],
  listFilters: [
    {
      key: 'CrmAccountCacUUID',
      paramKey: 'CrmAccountCacUUID',
      label: 'crm.title.accounts',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'crm/accounts', uuidField: 'CacUUID', labelField: 'CacName' },
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
      key: 'CcoContactPreference',
      paramKey: 'CcoContactPreference',
      label: 'crm.field.ContactPreference',
      type: 'select',
      translateOptions: true,
      options: [
        {
          value: 'not_recorded',
          label: 'crm.enum.not_recorded',
        },
        {
          value: 'email',
          label: 'crm.enum.email',
        },
        {
          value: 'phone',
          label: 'crm.enum.phone',
        },
        {
          value: 'both',
          label: 'crm.enum.both',
        },
        {
          value: 'blocked',
          label: 'crm.enum.blocked',
        },
      ],
      span: 1,
    },
  ],
  serverSidePagination: true,
  bulkDelete: false,
  quickCreateLabelField: 'CcoName',
  payload: (values, editing) =>
    crmPayload(values, editing, 'CcoRevision', ['CcoStatus', 'CcoRevision'], []),
  rowActions: crmActions('contacts'),
});
@Component({
  selector: 'app-crm-contacts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmContactPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
