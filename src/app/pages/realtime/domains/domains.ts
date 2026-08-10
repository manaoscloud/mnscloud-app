import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

const PURPOSE_OPTIONS = [
  { value: 'turn', label: 'TURN/STUN' },
  { value: 'webrtc', label: 'WebRTC' },
  { value: 'media', label: 'Media/RTP' },
  { value: 'sfu', label: 'SFU' },
  { value: 'signaling', label: 'Signaling' },
  { value: 'chat', label: 'Chat' },
  { value: 'mixed', label: 'Mixed' },
] as const;

function realtimeDomainConfig(endpoint: string, titlePrefix = 'Realtime'): ConfigurableCrudConfig {
  return {
    endpoint,
    uuidField: 'RtdUUID',
    pageTitle: `${titlePrefix} Domains`,
    pageDescription:
      'Manage public realtime domains used by TURN/STUN, WebRTC, SFU and signaling edges.',
    createTitle: 'New realtime domain',
    editTitle: 'Edit realtime domain',
    dialogDescription: 'Public realtime domain assigned to realtime edge services.',
    searchPlaceholder: 'Search realtime domains',
    emptyLabel: 'No realtime domains found.',
    deleteTitle: 'Delete realtime domain',
    deleteMessage: 'Delete this realtime domain?',
    deleteSelectedTitle: 'Delete selected realtime domains',
    deleteSelectedMessage: 'Delete {count} selected realtime domains?',
    savedMessage: 'Realtime domain saved.',
    deletedMessage: 'Realtime domain deleted.',
    deleteFailedMessage: 'Failed to delete realtime domain.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    initialValues: {
      status: 1,
      name: '',
      purpose: 'webrtc',
      notes: '',
    },
    columns: [
      { id: 'name', label: 'Domain', kind: 'identity', field: 'RtdName', uuidField: 'RtdUUID' },
      { id: 'purpose', label: 'Purpose', field: 'RtdPurpose' },
      { id: 'scope', label: 'Scope', field: 'RtdScope' },
      {
        id: 'status',
        label: 'Status',
        kind: 'status',
        field: 'RtdStatus',
        className: 'status-col',
      },
      { id: 'updatedAt', label: 'Updated', field: 'RtdDateUpdated', kind: 'datetime' },
    ],
    fields: [
      {
        key: 'status',
        source: 'RtdStatus',
        payloadKey: 'status',
        label: 'Status',
        type: 'status',
        span: 1,
      },
      {
        key: 'name',
        source: 'RtdName',
        payloadKey: 'name',
        label: 'Domain',
        required: true,
        span: 1,
      },
      {
        key: 'purpose',
        source: 'RtdPurpose',
        payloadKey: 'purpose',
        label: 'Purpose',
        type: 'select',
        required: true,
        options: PURPOSE_OPTIONS,
        span: 1,
      },
      {
        key: 'notes',
        source: 'RtdNotes',
        payloadKey: 'notes',
        label: 'Notes',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
  };
}

abstract class RealtimeDomainsBasePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  protected readonly tenantOnly: boolean;

  protected constructor(config: ConfigurableCrudConfig, tenantOnly = false) {
    super(config);
    this.tenantOnly = tenantOnly;
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    const items = await super.fetchItems(filters);
    if (!this.tenantOnly) return items;
    return items.filter((item) => item['RtdScope'] === 'tenant');
  }
}

@Component({
  selector: 'app-realtime-domains',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeDomainsPage extends RealtimeDomainsBasePage {
  constructor() {
    super(realtimeDomainConfig('system/realtime/domains', 'Realtime'));
  }
}

@Component({
  selector: 'app-realtime-domains-tenant',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeDomainsTenantPage extends RealtimeDomainsBasePage {
  constructor() {
    super(realtimeDomainConfig('realtime/domains', 'My Realtime'), true);
  }
}
