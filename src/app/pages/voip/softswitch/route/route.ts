import { Component } from '@angular/core';

import { CONFIGURABLE_CRUD_IMPORTS } from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  SoftswitchResourceCrudPage,
  softswitchResourceConfig,
} from '../shared/softswitch-resource-crud';

const ROUTE_CONFIG = softswitchResourceConfig({
  endpoint: 'voip/softswitch/routes',
  pageTitle: 'Softswitch routes',
  pageDescription: 'Register prefix and pattern routing rules.',
  createTitle: 'New route',
  editTitle: 'Edit route',
  initialValues: {
    accountUUID: '',
    name: '',
    prefix: '',
    direction: 'outbound',
    priority: 100,
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
    { key: 'direction', source: 'direction', payloadKey: 'direction', label: 'Direction', span: 1 },
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
  selector: 'app-voip-softswitch-route',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchRoutePage extends SoftswitchResourceCrudPage {
  constructor() {
    super(ROUTE_CONFIG);
  }
}
