import { Component } from '@angular/core';

import {
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  SoftswitchResourceCrudPage,
  softswitchResourceConfig,
} from '../shared/softswitch-resource-crud';

const CDR_CONFIG = softswitchResourceConfig({
  endpoint: 'voip/softswitch/cdrs',
  pageTitle: 'Softswitch CDR/Billing',
  pageDescription: 'Inspect and register billing call records.',
  createTitle: 'New CDR',
  editTitle: 'Edit CDR',
  activeValue: 'answered',
  inactiveValue: 'failed',
  initialValues: {
    accountUUID: '',
    name: '',
    calleeNumber: '',
    callStatus: 'failed',
    direction: 'outbound',
    durationSeconds: 0,
    billSeconds: 0,
    costAmount: 0,
    sellAmount: 0,
  },
  columns: [
    { id: 'callee', label: 'Callee', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'account', label: 'Softswitch', field: 'accountName' },
    { id: 'status', label: 'Status', field: 'status' },
  ],
  fields: [
    {
      key: 'accountUUID',
      source: 'accountUUID',
      payloadKey: 'accountUUID',
      label: 'Softswitch',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'callStatus',
      source: 'status',
      payloadKey: 'callStatus',
      label: 'Status',
      type: 'select',
      span: 1,
      options: [
        { value: 'answered', label: 'Answered' },
        { value: 'failed', label: 'Failed' },
        { value: 'busy', label: 'Busy' },
        { value: 'no_answer', label: 'No answer' },
      ],
    },
    {
      key: 'calleeNumber',
      source: 'name',
      payloadKey: 'calleeNumber',
      label: 'Callee',
      required: true,
      span: 1,
    },
    { key: 'direction', source: 'direction', payloadKey: 'direction', label: 'Direction', span: 1 },
    {
      key: 'durationSeconds',
      source: 'durationSeconds',
      payloadKey: 'durationSeconds',
      label: 'Duration seconds',
      type: 'number',
      span: 1,
    },
    {
      key: 'billSeconds',
      source: 'billSeconds',
      payloadKey: 'billSeconds',
      label: 'Bill seconds',
      type: 'number',
      span: 1,
    },
    {
      key: 'costAmount',
      source: 'costAmount',
      payloadKey: 'costAmount',
      label: 'Cost amount',
      type: 'number',
      span: 1,
    },
    {
      key: 'sellAmount',
      source: 'sellAmount',
      payloadKey: 'sellAmount',
      label: 'Sell amount',
      type: 'number',
      span: 1,
    },
  ],
});

@Component({
  selector: 'app-voip-softswitch-cdr-billing',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchCdrBillingPage extends SoftswitchResourceCrudPage {
  constructor() {
    super(CDR_CONFIG);
  }

  override statusOptions() {
    return [
      { value: '', label: 'All' },
      { value: 'answered', label: 'Answered' },
      { value: 'failed', label: 'Failed' },
      { value: 'busy', label: 'Busy' },
      { value: 'no_answer', label: 'No answer' },
    ];
  }

  override statusLabel(value: unknown): string {
    return String(value ?? '-');
  }

  override isActiveStatus(value: unknown): boolean {
    return String(value ?? '') === 'answered';
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return payload;
  }
}
