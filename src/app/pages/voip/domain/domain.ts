import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

const statusOptions: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const purposeOptions: ConfigurableCrudOption[] = [
  { value: 'pabx', label: 'PABX' },
  { value: 'softswitch', label: 'Softswitch' },
  { value: 'sbc', label: 'SBC' },
];

function domainConfig(scope: 'tenant' | 'master'): ConfigurableCrudConfig {
  const master = scope === 'master';
  return {
    endpoint: master ? 'system/voip/domains' : 'voip/domains',
    uuidField: 'VdmUUID',
    pageTitle: 'VoIP Domains',
    pageDescription: 'Manage canonical VoIP domains by purpose.',
    createTitle: 'New VoIP domain',
    editTitle: 'Edit VoIP domain',
    dialogDescription: 'Register the canonical SIP domain and its service purpose.',
    searchPlaceholder: 'Search domains',
    emptyLabel: 'No domains found.',
    deleteTitle: 'Delete domain',
    deleteMessage: 'Delete this VoIP domain?',
    deleteSelectedTitle: 'Delete selected domains',
    deleteSelectedMessage: 'Delete {count} selected VoIP domains?',
    savedMessage: 'VoIP domain saved successfully.',
    deletedMessage: 'VoIP domain deleted successfully.',
    deleteFailedMessage: 'Failed to delete VoIP domain.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions,
    initialValues: { name: '', purpose: 'pabx', status: 1 },
    columns: [
      { id: 'name', label: 'Domain', kind: 'identity', field: 'VdmName', uuidField: 'VdmUUID' },
      { id: 'purpose', label: 'Purpose', kind: 'text', field: 'VdmPurpose' },
      { id: 'status', label: 'Status', kind: 'status', field: 'VdmStatus' },
    ],
    fields: [
      { key: 'status', source: 'VdmStatus', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
      { key: 'purpose', source: 'VdmPurpose', payloadKey: 'purpose', label: 'Purpose', type: 'select', options: purposeOptions, required: true, span: 1 },
      { key: 'name', source: 'VdmName', payloadKey: 'name', label: 'Domain', type: 'text', required: true, placeholder: 'pbx.example.com', span: 2 },
    ],
  };
}

@Component({
  selector: 'app-voip-domain',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipDomainPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const route = inject(ActivatedRoute);
    super(domainConfig(route.snapshot.data['scope'] === 'master' ? 'master' : 'tenant'));
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      name: String(payload['name'] ?? '').trim(),
      purpose: String(payload['purpose'] ?? '').trim(),
      status: Number(payload['status']) === 1,
    };
  }
}
