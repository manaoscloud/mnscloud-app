import { Component } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const yesNo: ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/dial-plans',
    uuidField: 'uuid',
    pageTitle: 'Dial Plans',
    pageDescription: 'Manage reusable dialing plans for PABX accounts and extensions.',
    createTitle: 'New dial plan',
    editTitle: 'Edit dial plan',
    dialogDescription: 'Maintain the dialing plan identity and default behavior.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No dial plans found.',
    deleteTitle: 'Delete dial plan',
    deleteMessage: 'Delete this dial plan?',
    deleteSelectedTitle: 'Delete selected dial plans',
    deleteSelectedMessage: 'Delete {count} selected dial plans?',
    savedMessage: 'Dial plan saved successfully.',
    deletedMessage: 'Dial plan deleted successfully.',
    deleteFailedMessage: 'Failed to delete dial plan.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    initialValues: {
      enabled: 1,
      isDefault: 0,
      name: '',
      description: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
      { id: 'isDefault', label: 'Default', kind: 'boolean', field: 'isDefault' },
      { id: 'status', label: 'Status', kind: 'status', field: 'enabled' },
    ],
    fields: [
      { key: 'enabled', source: 'enabled', label: 'Status', type: 'status', span: 1 },
      {
        key: 'isDefault',
        source: 'isDefault',
        label: 'Default',
        type: 'select',
        options: yesNo,
        span: 1,
      },
      { key: 'name', source: 'name', label: 'Name', required: true, span: 1 },
      {
        key: 'description',
        source: 'description',
        label: 'Description',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-dial-plan-plan',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxDialPlanPlanPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config());
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      isDefault: Number(payload['isDefault']) === 1,
    };
  }
}
