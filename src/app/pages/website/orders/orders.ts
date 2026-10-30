import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { WEBSITE_ORDERS_ENDPOINT, WebsiteService } from '../website.service';
import { WEBSITE_OFFER_CYCLE_OPTIONS, WEBSITE_OFFER_KIND_OPTIONS } from '../offers/offers';

export const WEBSITE_ORDER_STATUS_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'awaiting_approval', label: 'website.orderStatus.awaiting_approval' },
  { value: 'awaiting_payment', label: 'website.orderStatus.awaiting_payment' },
  { value: 'paid', label: 'website.orderStatus.paid' },
  { value: 'provisioning', label: 'website.orderStatus.provisioning' },
  { value: 'active', label: 'website.orderStatus.active' },
  { value: 'failed', label: 'website.orderStatus.failed' },
  { value: 'cancelled', label: 'website.orderStatus.cancelled' },
  { value: 'expired', label: 'website.orderStatus.expired' },
];

function statusChip(value: unknown): string {
  const status = String(value ?? '');
  if (status === 'active' || status === 'paid') return 'chip-success';
  if (status === 'failed' || status === 'cancelled' || status === 'expired') return 'chip-failed';
  if (status === 'awaiting_approval' || status === 'awaiting_payment') return 'chip-queued';
  return 'chip-running';
}

function optionLabel(
  options: ConfigurableCrudOption[],
  value: unknown,
  translate: (key: string) => string,
) {
  const option = options.find((o) => o.value === value);
  return option ? translate(option.label) : String(value ?? '');
}

function websiteOrdersConfig(): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: WEBSITE_ORDERS_ENDPOINT,
    uuidField: 'orderUUID',
    pageTitle: 'website.orders',
    pageDescription: 'website.ordersDescription',
    createTitle: 'website.orders',
    editTitle: 'website.orders',
    dialogDescription: 'website.ordersDescription',
    searchPlaceholder: 'website.searchOrders',
    emptyLabel: 'website.noOrders',
    deleteTitle: 'website.orders',
    deleteMessage: 'website.orders',
    savedMessage: 'website.orderUpdated',
    deletedMessage: 'website.orderUpdated',
    deleteFailedMessage: 'website.orderUpdated',
    initialPageSize: 25,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusMode: 'string',
    activeValue: 'active',
    inactiveValue: 'cancelled',
    statusOptions: WEBSITE_ORDER_STATUS_OPTIONS,
    statusFilter: true,
    initialValues: {},
    fields: [],
    columns: [
      {
        id: 'id',
        field: 'id',
        label: 'website.orderNumber',
        kind: 'identity',
        uuidField: 'orderUUID',
      },
      {
        id: 'customerName',
        field: 'customerName',
        label: 'website.orderCustomer',
        kind: 'related',
        uuidField: 'customerUUID',
      },
      { id: 'offerName', field: 'offerName', label: 'website.offerName', kind: 'text' },
      {
        id: 'kind',
        field: 'kind',
        label: 'website.offerKindLabel',
        kind: 'text',
        width: 'sm',
        value: (row, translate) => optionLabel(WEBSITE_OFFER_KIND_OPTIONS, row['kind'], translate),
      },
      { id: 'price', field: 'price', label: 'website.offerPrice', kind: 'currency', width: 'sm' },
      {
        id: 'cycle',
        field: 'cycle',
        label: 'website.offerCycleLabel',
        kind: 'text',
        width: 'sm',
        value: (row, translate) =>
          optionLabel(WEBSITE_OFFER_CYCLE_OPTIONS, row['cycle'], translate),
      },
      {
        id: 'firstAmount',
        field: 'firstAmount',
        label: 'website.orderFirstAmount',
        kind: 'currency',
        width: 'sm',
      },
      {
        id: 'chargeStatus',
        field: 'chargeStatus',
        label: 'website.orderChargeStatus',
        kind: 'text',
        width: 'sm',
        optional: true,
      },
      { id: 'dateCreated', field: 'dateCreated', label: 'website.orderDate', kind: 'datetime' },
      {
        id: 'expiresAt',
        field: 'expiresAt',
        label: 'website.orderExpiresAt',
        kind: 'datetime',
        optional: true,
      },
      {
        id: 'status',
        field: 'status',
        label: 'Status',
        kind: 'status',
        options: WEBSITE_ORDER_STATUS_OPTIONS,
        className: 'status-col',
        chipClass: statusChip,
      },
    ],
  });
}

const APPROVE_ACTION: ConfigurableCrudRowAction = {
  key: 'approve',
  label: 'website.approveOrder',
  icon: 'task_alt',
  tooltip: 'website.approveOrderTooltip',
};
const CANCEL_ACTION: ConfigurableCrudRowAction = {
  key: 'cancel',
  label: 'website.cancelOrder',
  icon: 'cancel',
  tooltip: 'website.cancelOrderTooltip',
};

/**
 * Website › Orders (tenant): offers contracted on the sites and in the customer portal, with the
 * first charge issued on the tenant's gateway. Approval offers wait here for "Approve".
 */
@Component({
  selector: 'app-website-orders',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class WebsiteOrdersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly website = inject(WebsiteService);

  constructor() {
    super(websiteOrdersConfig());
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const status = String(row['status'] ?? '');
    return [
      ...(status === 'awaiting_approval' ? [APPROVE_ACTION] : []),
      ...(status === 'awaiting_approval' || status === 'awaiting_payment' ? [CANCEL_ACTION] : []),
    ];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = this.recordUUID(row);
    if (!uuid || (action.key !== 'approve' && action.key !== 'cancel')) return;
    const confirmed = await this.confirmAction(
      action.key === 'approve' ? 'website.approveOrder' : 'website.cancelOrder',
      action.key === 'approve' ? 'website.approveOrderConfirm' : 'website.cancelOrderConfirm',
      action.key === 'approve' ? 'website.approveOrder' : 'website.cancelOrder',
    );
    if (!confirmed) return;
    try {
      await this.website.decideOrder(uuid, action.key);
      this.snack.success(this.t('website.orderUpdated'));
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
    this.refreshList();
  }
}
