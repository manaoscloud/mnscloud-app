import { Component } from '@angular/core';

import { CONFIGURABLE_CRUD_IMPORTS } from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  SoftswitchResourceCrudPage,
  softswitchResourceConfig,
} from '../shared/softswitch-resource-crud';

const TRUNK_CONFIG = softswitchResourceConfig({
  endpoint: 'voip/softswitch/trunks',
  pageTitle: 'Softswitch trunks',
  pageDescription: 'Register upstream and carrier trunks.',
  createTitle: 'New trunk',
  editTitle: 'Edit trunk',
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'account', label: 'Softswitch', field: 'accountName' },
    { id: 'host', label: 'Host', field: 'host' },
    { id: 'direction', label: 'Direction', field: 'direction' },
    { id: 'transport', label: 'Transport', field: 'transport' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  initialValues: {
    accountUUID: '',
    name: '',
    host: '',
    direction: 'both',
    transport: 'udp',
    port: 5060,
    trustedCidrs: '',
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
    { key: 'host', source: 'host', payloadKey: 'host', label: 'Host', required: true, span: 1 },
    { key: 'direction', source: 'direction', payloadKey: 'direction', label: 'Direction', span: 1 },
    { key: 'transport', source: 'transport', payloadKey: 'transport', label: 'Transport', span: 1 },
    { key: 'port', source: 'port', payloadKey: 'port', label: 'Port', type: 'number', span: 1 },
    {
      key: 'trustedCidrs',
      source: 'trustedCidrs',
      payloadKey: 'trustedCidrs',
      label: 'Trusted CIDRs',
      span: 2,
    },
  ],
});

@Component({
  selector: 'app-voip-softswitch-trunk',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchTrunkPage extends SoftswitchResourceCrudPage {
  constructor() {
    super(TRUNK_CONFIG);
  }
}
