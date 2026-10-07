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
      key: 'CcoStatus',
      source: 'CcoStatus',
      label: 'crm.field.Status',
      span: 1,
      required: true,
      type: 'status',
    },
    {
      key: 'CcoContactPreference',
      source: 'CcoContactPreference',
      label: 'crm.field.ContactPreference',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: CRM_OPTIONS.contactPreferences,
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
      key: 'CcoName',
      source: 'CcoName',
      label: 'crm.field.Name',
      span: 2,
      required: true,
      type: 'text',
    },
    {
      key: 'CcoPosition',
      source: 'CcoPosition',
      label: 'crm.field.Position',
      span: 2,
      required: false,
      type: 'text',
    },
    {
      key: 'CcoEmail',
      source: 'CcoEmail',
      label: 'crm.field.Email',
      span: 2,
      required: false,
      type: 'email',
    },
    {
      key: 'CcoPhone',
      source: 'CcoPhone',
      label: 'crm.field.Phone',
      span: 2,
      required: false,
      type: 'phone',
    },
    {
      key: 'CcoPreferenceEvidence',
      source: 'CcoPreferenceEvidence',
      label: 'crm.field.PreferenceEvidence',
      span: 4,
      required: false,
      type: 'textarea',
      rows: 4,
      breakBefore: true,
    },
    { key: 'CcoRevision', source: 'CcoRevision', label: 'crm.field.Revision', hidden: true },
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
      options: CRM_OPTIONS.contactPreferences,
      span: 1,
    },
  ],
  serverSidePagination: true,
  // CRM deletion is individually audited; see app.md, CRM form baseline.
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
