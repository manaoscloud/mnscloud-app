import {
  ConfigurableCrudConfig,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { SoftswitchCrudPageBase } from './softswitch-crud-base';

export type SoftswitchResourceRow = ConfigurableCrudRecord & {
  uuid: string;
  id?: string;
  name?: string;
  status?: string | number | boolean;
  accountUUID?: string;
  accountName?: string;
};

export abstract class SoftswitchResourceCrudPage extends SoftswitchCrudPageBase<SoftswitchResourceRow> {
  protected constructor(config: ConfigurableCrudConfig) {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next = { ...payload };
    if (Object.prototype.hasOwnProperty.call(next, 'status')) {
      next['status'] = Number(next['status']) === 1;
    }
    return next;
  }
}

export function softswitchResourceConfig(
  overrides: Partial<ConfigurableCrudConfig> & Pick<ConfigurableCrudConfig, 'endpoint'>,
): ConfigurableCrudConfig {
  return {
    uuidField: 'uuid',
    pageTitle: 'Softswitch resource',
    pageDescription: 'Manage Softswitch resource records.',
    createTitle: 'New resource',
    editTitle: 'Edit resource',
    dialogDescription: 'Maintain the resource data for this tenant Softswitch.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No records found.',
    deleteTitle: 'Delete record',
    deleteMessage: 'Are you sure you want to delete this record?',
    deleteSelectedTitle: 'Delete selected records',
    deleteSelectedMessage: 'Delete {count} selected records?',
    savedMessage: 'Record saved successfully.',
    deletedMessage: 'Record deleted successfully.',
    deleteFailedMessage: 'Failed to delete record.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    initialValues: {
      accountUUID: '',
      name: '',
      status: 1,
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
      { id: 'account', label: 'Softswitch', field: 'accountName' },
      { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
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
        key: 'status',
        source: 'status',
        payloadKey: 'status',
        label: 'Status',
        type: 'status',
        span: 1,
      },
      { key: 'name', source: 'name', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    ],
    ...overrides,
  };
}
