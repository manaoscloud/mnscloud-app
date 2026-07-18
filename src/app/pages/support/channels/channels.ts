import { Component } from '@angular/core';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

const providers: ConfigurableCrudOption[] = [
  'whatsapp-cloud', 'whatsapp-twilio', 'messenger', 'instagram', 'telegram', 'webchat',
].map((value) => ({ value, label: value }));
const statuses: ConfigurableCrudOption[] = [
  { value: 'connected', label: 'Connected' }, { value: 'disconnected', label: 'Disconnected' },
  { value: 'pending', label: 'Pending' }, { value: 'error', label: 'Error' },
];
const config: ConfigurableCrudConfig = {
  endpoint: 'support/channels', uuidField: 'SupportChannelUUID', pageTitle: 'Support channels',
  pageDescription: 'Manage tenant support channel identities.', createTitle: 'New support channel',
  editTitle: 'Edit support channel', dialogDescription: 'Maintain the support channel identity and status.',
  searchPlaceholder: 'Search', emptyLabel: 'No support channels found.', deleteTitle: 'Delete support channel',
  deleteMessage: 'Delete this support channel?', deleteSelectedTitle: 'Delete selected support channels',
  deleteSelectedMessage: 'Delete {count} selected support channels?', savedMessage: 'Support channel saved successfully.',
  deletedMessage: 'Support channel deleted successfully.', deleteFailedMessage: 'Failed to delete support channel.',
  statusMode: 'string', activeValue: 'connected', inactiveValue: 'disconnected', activeStatusValues: ['connected', 'pending'],
  statusOptions: statuses, statusFilter: false, bulkDelete: false,
  initialValues: { provider: 'whatsapp-cloud', displayName: '', status: 'pending' },
  columns: [
    { id: 'displayName', label: 'Name', kind: 'identity', field: 'DisplayName', uuidField: 'SupportChannelUUID' },
    { id: 'provider', label: 'Provider', field: 'Provider' }, { id: 'status', label: 'Status', kind: 'status', field: 'Status' },
    { id: 'lastSyncAt', label: 'Last sync', kind: 'datetime', field: 'LastSyncAt' },
  ],
  listFilters: [{ key: 'provider', label: 'Provider', type: 'select', options: providers, span: 1 }, { key: 'channelStatus', paramKey: 'status', label: 'Status', type: 'select', options: statuses, span: 1 }],
  fields: [
    { key: 'provider', label: 'Provider', type: 'select', options: providers, required: true, span: 1 },
    { key: 'status', label: 'Status', type: 'select', options: statuses, required: true, span: 1 },
    { key: 'displayName', label: 'Name', required: true, span: 2 },
  ],
};
@Component({ selector: 'app-support-channels', standalone: true, imports: CONFIGURABLE_CRUD_IMPORTS, templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html', styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'] })
export class SupportChannelsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> { constructor() { super(config); } }
