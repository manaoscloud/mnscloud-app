import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';

const statusOptions: ConfigurableCrudOption[] = [
  { value: 'requested', label: 'Requested' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const directionOptions: ConfigurableCrudOption[] = [
  { value: 'port_in', label: 'Port in' },
  { value: 'port_out', label: 'Port out' },
];

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/portability-orders',
    uuidField: 'VoipPortabilityOrderUUID',
    pageTitle: 'Portability orders',
    pageDescription: 'Track tenant portability requests and their operational history.',
    createTitle: 'New portability order',
    editTitle: 'Portability order',
    dialogDescription:
      'Create a requested portability order. Its status changes through explicit workflow actions.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No portability orders found.',
    deleteTitle: 'Delete portability order',
    deleteMessage: 'Portability orders cannot be deleted.',
    deleteSelectedTitle: 'Delete selected portability orders',
    deleteSelectedMessage: 'Portability orders cannot be deleted.',
    savedMessage: 'Portability order created successfully.',
    deletedMessage: 'Portability order deleted successfully.',
    deleteFailedMessage: 'Failed to delete portability order.',
    statusMode: 'string',
    activeValue: 'completed',
    inactiveValue: 'requested',
    activeStatusValues: ['requested', 'scheduled', 'confirmed', 'completed'],
    statusOptions,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    initialValues: {
      customerUUID: '',
      direction: 'port_in',
      donorOperatorUUID: '',
      recipientOperatorUUID: '',
      numbers: '',
      protocol: '',
      notes: '',
    },
    columns: [
      {
        id: 'order',
        label: 'Order',
        kind: 'identity',
        field: 'VoipPortabilityOrderID',
        uuidField: 'VoipPortabilityOrderUUID',
      },
      {
        id: 'customer',
        label: 'Customer',
        kind: 'related',
        field: 'CustomerName',
        uuidField: 'CustomerCusUUID',
      },
      { id: 'direction', label: 'Direction', field: 'Direction' },
      { id: 'numbers', label: 'Numbers', field: 'ItemCount' },
      { id: 'firstNumber', label: 'First number', field: 'FirstNumber' },
      { id: 'requestedAt', label: 'Requested at', kind: 'datetime', field: 'RequestedAt' },
      { id: 'status', label: 'Status', kind: 'status', field: 'Status' },
    ],
    listFilters: [
      { key: 'customerUUID', label: 'Customer', type: 'search-select', span: 1 },
      {
        key: 'direction',
        label: 'Direction',
        type: 'select',
        span: 1,
        options: directionOptions,
        translateOptions: true,
      },
    ],
    rowActions: [
      { key: 'view', label: 'View details', icon: 'visibility', tooltip: 'View details' },
      { key: 'schedule', label: 'Schedule', icon: 'event', tooltip: 'Schedule' },
      { key: 'confirm', label: 'Confirm', icon: 'verified', tooltip: 'Confirm' },
      { key: 'complete', label: 'Complete', icon: 'task_alt', tooltip: 'Complete' },
    ],
    fields: [
      { key: 'customerUUID', label: 'Customer', type: 'search-select', required: true, span: 1 },
      {
        key: 'direction',
        label: 'Direction',
        type: 'select',
        options: directionOptions,
        required: true,
        span: 1,
      },
      {
        key: 'donorOperatorUUID',
        label: 'Donor operator',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'recipientOperatorUUID',
        label: 'Recipient operator',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'numbers',
        label: 'Numbers',
        type: 'textarea',
        placeholder: 'One E.164 number per line or separated by commas.',
        required: true,
        span: 4,
        rows: 4,
      },
      { key: 'protocol', label: 'Carrier protocol', span: 2 },
      { key: 'notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
    ],
  };
}

@Component({
  selector: 'app-voip-portability-orders',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPortabilityOrdersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly customers = signal<ConfigurableCrudOption[]>([]);
  readonly operators = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return (
      ['customerUUID', 'donorOperatorUUID', 'recipientOperatorUUID'].includes(field.key) &&
      this.lookupsLoading()
    );
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'customerUUID') return this.customers();
    if (key === 'donorOperatorUUID' || key === 'recipientOperatorUUID') return this.operators();
    return [];
  }

  override listFilterOptions(
    filter: ConfigurableCrudListFilter,
  ): readonly ConfigurableCrudOption[] {
    return filter.key === 'customerUUID' ? this.customers() : super.listFilterOptions(filter);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, numbers: String(payload['numbers'] ?? '').trim() };
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const actions = config().rowActions ?? [];
    const status = String(row['Status'] ?? '').toLowerCase();
    const allowed = new Set(['view']);
    if (status === 'requested') allowed.add('schedule');
    if (status === 'scheduled') allowed.add('confirm');
    if (status === 'confirmed') allowed.add('complete');
    return actions.filter((action) => allowed.has(action.key));
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    const uuid = String(row['VoipPortabilityOrderUUID'] ?? '');
    if (!uuid) return;

    if (action.key === 'view') {
      await this.openDetails(uuid);
      return;
    }

    const confirmed = await this.confirmAction(
      `${action.label} portability order`,
      `Confirm changing this portability order to ${action.label.toLowerCase()}?`,
      action.label,
    );
    if (!confirmed) return;

    try {
      await this.rawApi.post(`voip/portability-orders/${uuid}/transitions`, { action: action.key });
      this.snack.success(`Portability order ${action.label.toLowerCase()} successfully.`);
      this.itemsResource.reload();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to transition portability order.');
    }
  }

  private async openDetails(uuid: string): Promise<void> {
    try {
      const [orderResponse, itemsResponse, eventsResponse] = await Promise.all([
        this.rawApi.get<any>(`voip/portability-orders/${uuid}`),
        this.rawApi.get<any>(`voip/portability-orders/${uuid}/items`),
        this.rawApi.get<any>(`voip/portability-orders/${uuid}/events`),
      ]);
      const order = orderResponse?.data ?? {};
      const items = itemsResponse?.data?.items ?? [];
      const events = eventsResponse?.data?.items ?? [];
      openDataViewerDialog(this.dialog, {
        title: 'Portability order details',
        description: 'Review the portability request, its numbers and operational history.',
        status: { label: 'Status', value: String(order.Status ?? '-') },
        details: [
          { label: 'Order', value: order.VoipPortabilityOrderID },
          { label: 'Customer', value: order.CustomerName },
          { label: 'Direction', value: order.Direction },
          { label: 'Donor operator', value: order.DonorOperatorName },
          { label: 'Recipient operator', value: order.RecipientOperatorName },
          { label: 'Carrier protocol', value: order.Protocol },
          { label: 'Requested At', value: order.RequestedAt },
          { label: 'Scheduled At', value: order.ScheduledAt },
          { label: 'Confirmed At', value: order.ConfirmedAt },
          { label: 'Completed At', value: order.CompletedAt },
          { label: 'Reason', value: order.Reason, wide: true },
          { label: 'Notes', value: order.Notes, wide: true },
        ],
        sections: [
          {
            title: 'Numbers',
            code: { title: 'Numbers', value: items.map((item: any) => item.Number).join('\n'), format: 'text', copy: true },
          },
          {
            title: 'History',
            code: { title: 'History', value: events, format: 'json', copy: true },
          },
        ],
      });
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to load portability order details.');
    }
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const [customers, operators] = await Promise.all([
        fetchOptions(this.rawApi, 'erp/customers?status=1', 'CustomerUUID', 'Name'),
        fetchOptions(this.rawApi, 'voip/did/operators?status=1', 'VdoUUID', 'VdoName'),
      ]);
      this.customers.set(customers);
      this.operators.set(operators);
    } finally {
      this.lookupsLoading.set(false);
    }
  }
}

async function fetchOptions(
  api: ApiService,
  endpoint: string,
  id: string,
  label: string,
): Promise<ConfigurableCrudOption[]> {
  const response = await api.get<any>(`${endpoint}&limit=500&offset=0`);
  const rows = Array.isArray(response?.data?.items)
    ? response.data.items
    : Array.isArray(response?.data)
      ? response.data
      : [];
  return rows
    .map((row: any) => ({
      value: String(row[id] ?? ''),
      label: String(row[label] ?? ''),
      searchText: `${row[label] ?? ''} ${row[id] ?? ''}`,
    }))
    .filter((option: ConfigurableCrudOption) => option.value && option.label);
}
