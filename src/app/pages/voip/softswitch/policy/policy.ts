import { Component } from '@angular/core';

import { CONFIGURABLE_CRUD_IMPORTS } from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  SoftswitchResourceCrudPage,
  softswitchResourceConfig,
} from '../shared/softswitch-resource-crud';

const POLICY_CONFIG = softswitchResourceConfig({
  endpoint: 'voip/softswitch/policies',
  pageTitle: 'Softswitch policies',
  pageDescription: 'Register account, subscriber, trunk and route policies.',
  createTitle: 'New policy',
  editTitle: 'Edit policy',
  initialValues: { accountUUID: '', name: '', scope: 'account', priority: 100, status: 1 },
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
    { key: 'scope', source: 'scope', payloadKey: 'scope', label: 'Scope', required: true, span: 1 },
    {
      key: 'priority',
      source: 'priority',
      payloadKey: 'priority',
      label: 'Priority',
      type: 'number',
      span: 1,
    },
  ],
});

@Component({
  selector: 'app-voip-softswitch-policy',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchPolicyPage extends SoftswitchResourceCrudPage {
  constructor() {
    super(POLICY_CONFIG);
  }
}
