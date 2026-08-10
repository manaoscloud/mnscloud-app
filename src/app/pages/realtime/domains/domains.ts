import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
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

const REALTIME_DOMAIN_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/realtime/domains',
  uuidField: 'RtdUUID',
  pageTitle: 'Realtime Domains',
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
    purpose: 'turn',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Domain', kind: 'identity', field: 'RtdName', uuidField: 'RtdUUID' },
    { id: 'purpose', label: 'Purpose', field: 'RtdPurpose' },
    { id: 'status', label: 'Status', kind: 'status', field: 'RtdStatus', className: 'status-col' },
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

@Component({
  selector: 'app-realtime-domains',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RealtimeDomainsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(REALTIME_DOMAIN_CONFIG);
  }
}
