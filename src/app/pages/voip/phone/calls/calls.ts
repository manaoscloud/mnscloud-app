import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const DIRECTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
];

const RESULTS: readonly ConfigurableCrudOption[] = [
  { value: 'ringing', label: 'Ringing' },
  { value: 'active', label: 'In progress' },
  { value: 'answered', label: 'Answered' },
  { value: 'missed', label: 'Missed' },
  { value: 'unanswered', label: 'Not answered' },
];

const DISPOSITIONS: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'Not classified' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'follow_up', label: 'Follow up' },
  { value: 'no_interest', label: 'No interest' },
  { value: 'wrong_number', label: 'Wrong number' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'other', label: 'Other' },
];

function linked(row: ConfigurableCrudRecord): string {
  return [row['CustomerName'], row['CrmContactName'], row['CrmLeadName']]
    .filter(Boolean)
    .join(' · ');
}

const config = defineCrud({
  endpoint: 'voip/phone/calls',
  uuidField: 'VhkUUID',
  pageTitle: 'Calls',
  pageDescription:
    'Calls answered or made with the App phone, matched to customers, CRM contacts and leads by number. Record the outcome and notes; calls with a lead also appear as CRM activities.',
  editTitle: 'Call outcome',
  dialogDescription: 'Notes also go to the CRM activity of the call when it has a lead.',
  emptyLabel: 'No calls yet. Calls made or answered with the App phone appear here.',
  savedMessage: 'Call saved.',
  canCreate: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialValues: { disposition: '', notes: '', customer: '', contact: '', lead: '', revision: '' },
  listFilters: [
    {
      key: 'mine',
      paramKey: 'mine',
      label: 'Agent',
      type: 'select',
      span: 1,
      emptyLabel: 'Everyone',
      options: [{ value: '1', label: 'My calls' }],
    },
    {
      key: 'result',
      paramKey: 'result',
      label: 'Result',
      type: 'select',
      span: 1,
      emptyLabel: 'All',
      options: RESULTS,
    },
  ],
  columns: [
    {
      id: 'started',
      label: 'Started',
      field: 'VhkStartedAt',
      uuidField: 'VhkUUID',
      kind: 'datetime',
    },
    { id: 'direction', label: 'Direction', field: 'VhkDirection', options: DIRECTIONS },
    { id: 'number', label: 'Number', field: 'VhkRemoteNumber', kind: 'phone' },
    { id: 'who', label: 'Linked to', value: (row) => linked(row) },
    {
      id: 'result',
      label: 'Result',
      field: 'VhkResult',
      kind: 'status',
      options: RESULTS,
      chipClass: (value) =>
        value === 'answered' ? 'chip-success' : value === 'missed' ? 'chip-failed' : 'chip-skipped',
    },
    { id: 'duration', label: 'Duration (s)', field: 'VhkDurationSeconds', kind: 'number' },
    { id: 'agent', label: 'Agent', field: 'AgentName' },
    { id: 'outcome', label: 'Outcome', field: 'VhkDisposition', options: DISPOSITIONS },
    { id: 'line', label: 'Line', field: 'VhkLine', optional: true },
    { id: 'notes', label: 'Notes', field: 'VhkNotes', optional: true },
  ],
  fields: [
    { key: 'revision', source: 'VhkRevision', label: 'Revision', hidden: true },
    {
      key: 'disposition',
      source: 'VhkDisposition',
      label: 'Outcome',
      type: 'search-select',
      options: DISPOSITIONS,
      translateOptions: true,
    },
    { key: 'notes', source: 'VhkNotes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4 },
    {
      key: 'customer',
      source: 'RegCustomerRcuUUID',
      label: 'Customer',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'registry/customers',
        searchParam: 'q',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
    },
    {
      key: 'contact',
      source: 'CrmContactCcoUUID',
      label: 'CRM contact',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'crm/contacts',
        uuidField: 'CcoUUID',
        labelField: 'CcoName',
        selectedLabelField: 'CrmContactName',
      },
    },
    {
      key: 'lead',
      source: 'CrmLeadCleUUID',
      label: 'CRM lead',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'crm/leads',
        uuidField: 'CleUUID',
        labelField: 'CleName',
        selectedLabelField: 'CrmLeadName',
      },
    },
  ],
  payload: (values) => ({
    VhkRevision: Number(values['revision']),
    VhkDisposition: values['disposition'] || null,
    VhkNotes: values['notes'] || null,
    RegCustomerRcuUUID: values['customer'] || null,
    CrmContactCcoUUID: values['contact'] || null,
    CrmLeadCleUUID: values['lead'] || null,
  }),
});

@Component({
  selector: 'app-voip-phone-calls',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPhoneCallsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
