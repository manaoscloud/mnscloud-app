import { Component } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { SoftswitchCrudPageBase } from '../shared/softswitch-crud-base';
import { VoipSoftswitchSubscriberItem } from './subscriber.service';

const SUBSCRIBER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/subscribers',
  uuidField: 'VsuUUID',
  pageTitle: 'Softswitch subscribers',
  pageDescription: 'Manage SIP subscribers linked to tenant Softswitch accounts.',
  createTitle: 'New subscriber',
  editTitle: 'Edit subscriber',
  dialogDescription: 'Maintain SIP credentials, caller ID and registration policy.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No subscribers found.',
  deleteTitle: 'Delete subscriber',
  deleteMessage: 'Are you sure you want to delete this subscriber?',
  deleteSelectedTitle: 'Delete selected subscribers',
  deleteSelectedMessage: 'Delete {count} selected subscribers?',
  savedMessage: 'Subscriber saved successfully.',
  deletedMessage: 'Subscriber deleted successfully.',
  deleteFailedMessage: 'Failed to delete subscriber.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    accountUUID: '',
    username: '',
    password: '',
    callerIdName: '',
    callerIdNumber: '',
    context: 'default',
    maxContacts: 1,
    maxConcurrentCalls: 1,
    outboundCid: '',
    codecs: '',
    registerEnabled: 1,
    recordCalls: 1,
    enabled: 1,
  },
  columns: [
    {
      id: 'username',
      label: 'Username',
      kind: 'identity',
      field: 'VsuUsername',
      uuidField: 'VsuUUID',
    },
    { id: 'softswitch', label: 'Softswitch', field: 'SoftswitchName' },
    { id: 'customer', label: 'Customer', field: 'CustomerName' },
    { id: 'domain', label: 'Domain', field: 'DomainName' },
    { id: 'callerId', label: 'Caller ID', field: 'VsuCallerIdNumber' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VsuEnabled', className: 'status-col' },
  ],
  fields: [
    {
      key: 'accountUUID',
      source: 'VoipSoftswitchAccountVssUUID',
      payloadKey: 'accountUUID',
      label: 'Softswitch',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'enabled',
      source: 'VsuEnabled',
      payloadKey: 'enabled',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'username',
      source: 'VsuUsername',
      payloadKey: 'username',
      label: 'Username',
      required: true,
      span: 1,
    },
    {
      key: 'password',
      source: 'VsuPassword',
      payloadKey: 'password',
      label: 'Password',
      required: true,
      span: 1,
    },
    {
      key: 'callerIdName',
      source: 'VsuCallerIdName',
      payloadKey: 'callerIdName',
      label: 'Caller ID name',
      span: 1,
    },
    {
      key: 'callerIdNumber',
      source: 'VsuCallerIdNumber',
      payloadKey: 'callerIdNumber',
      label: 'Caller ID number',
      span: 1,
    },
    { key: 'context', source: 'VsuContext', payloadKey: 'context', label: 'Context', span: 1 },
    {
      key: 'maxContacts',
      source: 'VsuMaxContacts',
      payloadKey: 'maxContacts',
      label: 'Max contacts',
      type: 'number',
      span: 1,
    },
    {
      key: 'maxConcurrentCalls',
      source: 'VsuMaxConcurrentCalls',
      payloadKey: 'maxConcurrentCalls',
      label: 'Max concurrent calls',
      type: 'number',
      span: 1,
    },
    {
      key: 'outboundCid',
      source: 'VsuOutboundCid',
      payloadKey: 'outboundCid',
      label: 'Outbound CID',
      span: 1,
    },
    { key: 'codecs', source: 'VsuCodecs', payloadKey: 'codecs', label: 'Codecs', span: 1 },
    {
      key: 'registerEnabled',
      source: 'VsuRegisterEnabled',
      payloadKey: 'registerEnabled',
      label: 'Registration',
      type: 'select',
      span: 1,
      options: [
        { value: 1, label: 'Enabled' },
        { value: 0, label: 'Disabled' },
      ],
    },
    {
      key: 'recordCalls',
      source: 'VsuRecordCalls',
      payloadKey: 'recordCalls',
      label: 'Record calls',
      type: 'select',
      span: 1,
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
    },
  ],
};

@Component({
  selector: 'app-voip-softswitch-subscriber',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchSubscriberPage extends SoftswitchCrudPageBase<VoipSoftswitchSubscriberItem> {
  constructor() {
    super(SUBSCRIBER_CONFIG);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      maxContacts: Number(payload['maxContacts'] ?? 1),
      maxConcurrentCalls: Number(payload['maxConcurrentCalls'] ?? 1),
      registerEnabled: Number(payload['registerEnabled']) === 1,
      recordCalls: Number(payload['recordCalls']) === 1,
      enabled: Number(payload['enabled']) === 1,
    };
  }
}
