import { Component } from '@angular/core';

import { CONFIGURABLE_CRUD_IMPORTS } from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  SoftswitchResourceCrudPage,
  softswitchResourceConfig,
} from '../shared/softswitch-resource-crud';

const RATE_CONFIG = softswitchResourceConfig({
  endpoint: 'voip/softswitch/rates',
  pageTitle: 'Softswitch rates',
  pageDescription: 'Register rating prefixes for billing.',
  createTitle: 'New rate',
  editTitle: 'Edit rate',
  initialValues: {
    accountUUID: '',
    name: '',
    prefix: '',
    sellPerMinute: 0,
    costPerMinute: 0,
    minimumSeconds: 30,
    billingIncrementSeconds: 6,
    connectionFee: 0,
    status: 1,
  },
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
      key: 'status',
      source: 'status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    { key: 'name', source: 'name', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    {
      key: 'prefix',
      source: 'prefix',
      payloadKey: 'prefix',
      label: 'Prefix',
      required: true,
      span: 1,
    },
    {
      key: 'sellPerMinute',
      source: 'sellPerMinute',
      payloadKey: 'sellPerMinute',
      label: 'Sell/minute',
      type: 'number',
      span: 1,
    },
    {
      key: 'costPerMinute',
      source: 'costPerMinute',
      payloadKey: 'costPerMinute',
      label: 'Cost/minute',
      type: 'number',
      span: 1,
    },
    {
      key: 'minimumSeconds',
      source: 'minimumSeconds',
      payloadKey: 'minimumSeconds',
      label: 'Minimum seconds',
      type: 'number',
      span: 1,
    },
    {
      key: 'billingIncrementSeconds',
      source: 'billingIncrementSeconds',
      payloadKey: 'billingIncrementSeconds',
      label: 'Billing increment',
      type: 'number',
      span: 1,
    },
    {
      key: 'connectionFee',
      source: 'connectionFee',
      payloadKey: 'connectionFee',
      label: 'Connection fee',
      type: 'number',
      span: 1,
    },
  ],
});

@Component({
  selector: 'app-voip-softswitch-rate',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchRatePage extends SoftswitchResourceCrudPage {
  constructor() {
    super(RATE_CONFIG);
  }
}
