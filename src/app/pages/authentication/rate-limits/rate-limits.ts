import { authenticationPayload } from '../authentication-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

// Speeds are stored in kbit/s; the API/DB generate the Mikrotik-Rate-Limit text (ArlRateLimit).
const rate = (key: string, source: string, required: boolean, help: string) => ({
  key,
  source,
  label: `authentication.${key}`,
  help,
  span: 1 as const,
  required,
  type: 'number' as const,
  ...(required ? {} : { tab: 'limits' as const }),
});

const config = defineCrud({
  endpoint: 'authentication/rate-limits',
  uuidField: 'ArlUUID',
  pageTitle: 'authentication.rate-limits',
  pageDescription: 'authentication.rateLimitsDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and in-use confirmation; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['ArlRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    status: 1,
    revision: 1,
    AuthenticationAccountAacUUID: '',
    uploadKbps: '',
    downloadKbps: '',
    burstUploadKbps: '',
    burstDownloadKbps: '',
    burstThresholdUploadKbps: '',
    burstThresholdDownloadKbps: '',
    burstTimeSeconds: '',
    priority: '',
    minUploadKbps: '',
    minDownloadKbps: '',
  },
  payload: (values, editing) => authenticationPayload(values, editing),
  fields: [
    { key: 'status', source: 'ArlStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'revision', source: 'ArlRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'AuthenticationAccountAacUUID',
      source: 'AuthenticationAccountAacUUID',
      label: 'authentication.accounts',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'authentication/accounts',
        uuidField: 'AacUUID',
        labelField: 'AacName',
      },
      disabledWhen: ({ editing }) => editing,
      help: 'authentication.scopeHelp',
    },
    { key: 'name', source: 'ArlName', label: 'Name', required: true, span: 1 },
    rate('uploadKbps', 'ArlUploadKbps', true, 'authentication.rateKbpsHelp'),
    rate('downloadKbps', 'ArlDownloadKbps', true, 'authentication.rateKbpsHelp'),
    rate('burstUploadKbps', 'ArlBurstUploadKbps', false, 'authentication.burstHelp'),
    rate('burstDownloadKbps', 'ArlBurstDownloadKbps', false, 'authentication.burstHelp'),
    rate(
      'burstThresholdUploadKbps',
      'ArlBurstThresholdUploadKbps',
      false,
      'authentication.burstThresholdHelp',
    ),
    rate(
      'burstThresholdDownloadKbps',
      'ArlBurstThresholdDownloadKbps',
      false,
      'authentication.burstThresholdHelp',
    ),
    rate('burstTimeSeconds', 'ArlBurstTimeSeconds', false, 'authentication.burstTimeHelp'),
    rate('priority', 'ArlPriority', false, 'authentication.priorityHelp'),
    rate('minUploadKbps', 'ArlMinUploadKbps', false, 'authentication.minimumRateHelp'),
    rate('minDownloadKbps', 'ArlMinDownloadKbps', false, 'authentication.minimumRateHelp'),
    {
      key: 'notes',
      source: 'ArlNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    { id: 'name', field: 'ArlName', label: 'Name', kind: 'identity' },
    {
      id: 'account',
      field: 'AccountName',
      label: 'authentication.accounts',
      kind: 'related',
      uuidField: 'AuthenticationAccountAacUUID',
    },
    { id: 'value', field: 'ArlRateLimit', label: 'authentication.rateLimitValue', kind: 'text' },
    { id: 'status', field: 'ArlStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-rate-limits',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AuthenticationRateLimitPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
