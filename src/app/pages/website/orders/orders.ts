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

/** S5: where the activation of a paid order stands. */
export const WEBSITE_ORDER_ACTIVATION_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'pending', label: 'website.activationStep.pending' },
  { value: 'creating', label: 'website.activationStep.creating' },
  { value: 'waiting_resource', label: 'website.activationStep.waiting_resource' },
  { value: 'blocked', label: 'website.activationStep.blocked' },
  { value: 'manual', label: 'website.activationStep.manual' },
  { value: 'failed_resource', label: 'website.activationStep.failed_resource' },
  { value: 'done', label: 'website.activationStep.done' },
];

/** S6: how the customer cancelled from the portal. */
export const WEBSITE_ORDER_CANCEL_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'unpaid', label: 'website.cancelMode.unpaid' },
  { value: 'withdrawal', label: 'website.cancelMode.withdrawal' },
  { value: 'end_of_cycle', label: 'website.cancelMode.end_of_cycle' },
];

/** S6: manual refund of a withdrawal (the tenant records it). */
export const WEBSITE_ORDER_REFUND_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'pending', label: 'website.refundStatus.pending' },
  { value: 'refunded', label: 'website.refundStatus.refunded' },
];

const LINKABLE = new Set(['paid', 'provisioning']);
const RETRYABLE_STEPS = new Set(['blocked', 'failed_resource']);

/** Link form: a resource of the order's kind (the API checks it belongs to the order customer). */
function linkForm(row: ConfigurableCrudRecord, kind: 'vps' | 'webhost'): ConfigurableCrudConfig {
  const vps = kind === 'vps';
  return defineCrud({
    endpoint: `${WEBSITE_ORDERS_ENDPOINT}/${encodeURIComponent(String(row['orderUUID'] ?? ''))}/link`,
    uuidField: 'orderUUID',
    pageTitle: vps ? 'website.linkServer' : 'website.linkHosting',
    pageDescription: 'website.linkResourceDescription',
    createTitle: vps ? 'website.linkServer' : 'website.linkHosting',
    savedMessage: 'website.orderActivated',
    statusFilter: false,
    initialValues: {
      resourceType: vps ? 'HostingVpsInstance' : 'HostingWebhostHost',
      resourceUUID: '',
    },
    columns: [],
    fields: [
      { key: 'resourceType', label: 'website.resourceType', hidden: true },
      {
        key: 'resourceUUID',
        label: vps ? 'website.linkServerField' : 'website.linkHostingField',
        type: 'search-select',
        required: true,
        help: 'website.linkResourceHelp',
        span: 1,
        quickCreate: false,
        quickCreateExemptReason:
          'Servers and hostings are created in Hosting; this action only links one.',
        remoteLookup: vps
          ? {
              endpoint: 'hosting/vps/instances',
              uuidField: 'HviUUID',
              labelField: 'HviName',
              descriptionField: 'CustomerName',
            }
          : {
              endpoint: 'hosting/webhost/hosts',
              uuidField: 'HwhUUID',
              labelField: 'HwhName',
              descriptionField: 'CustomerName',
            },
      },
    ],
  });
}

/** Refund form: the tenant refunded the withdrawal through its own gateway or bank. */
function refundForm(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `${WEBSITE_ORDERS_ENDPOINT}/${encodeURIComponent(String(row['orderUUID'] ?? ''))}/refund`,
    uuidField: 'orderUUID',
    pageTitle: 'website.markRefunded',
    pageDescription: 'website.markRefundedDescription',
    createTitle: 'website.markRefunded',
    savedMessage: 'website.refundRecorded',
    statusFilter: false,
    initialValues: { note: '' },
    columns: [],
    fields: [
      {
        key: 'note',
        label: 'website.refundNote',
        type: 'textarea',
        span: 4,
        rows: 4,
        help: 'website.refundNoteHelp',
      },
    ],
  });
}

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
        id: 'activationStep',
        field: 'activationStep',
        label: 'website.activationStepLabel',
        kind: 'text',
        width: 'sm',
        optional: true,
        value: (row, translate) =>
          row['activationStep']
            ? optionLabel(WEBSITE_ORDER_ACTIVATION_OPTIONS, row['activationStep'], translate)
            : '',
      },
      {
        id: 'activationError',
        field: 'activationError',
        label: 'website.activationError',
        kind: 'text',
        optional: true,
      },
      {
        id: 'activatedAt',
        field: 'activatedAt',
        label: 'website.activatedAt',
        kind: 'datetime',
        optional: true,
      },
      {
        id: 'cancelMode',
        field: 'cancelMode',
        label: 'website.cancelModeLabel',
        kind: 'text',
        width: 'sm',
        optional: true,
        value: (row, translate) =>
          row['cancelMode']
            ? optionLabel(WEBSITE_ORDER_CANCEL_OPTIONS, row['cancelMode'], translate)
            : '',
      },
      {
        id: 'cancelAt',
        field: 'cancelAt',
        label: 'website.cancelAt',
        kind: 'datetime',
        optional: true,
      },
      {
        id: 'refundStatus',
        field: 'refundStatus',
        label: 'website.refundStatusLabel',
        kind: 'text',
        width: 'sm',
        optional: true,
        value: (row, translate) =>
          row['refundStatus']
            ? optionLabel(WEBSITE_ORDER_REFUND_OPTIONS, row['refundStatus'], translate)
            : '',
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
const LINK_SERVER_ACTION: ConfigurableCrudRowAction = {
  key: 'link-server',
  label: 'website.linkServer',
  icon: 'link',
  tooltip: 'website.linkResourceTooltip',
  form: (row) => linkForm(row, 'vps'),
};
const LINK_HOSTING_ACTION: ConfigurableCrudRowAction = {
  key: 'link-hosting',
  label: 'website.linkHosting',
  icon: 'link',
  tooltip: 'website.linkResourceTooltip',
  form: (row) => linkForm(row, 'webhost'),
};
const REFUND_ACTION: ConfigurableCrudRowAction = {
  key: 'mark-refunded',
  label: 'website.markRefunded',
  icon: 'currency_exchange',
  tooltip: 'website.markRefundedTooltip',
  form: (row) => refundForm(row),
};
const RETRY_ACTION: ConfigurableCrudRowAction = {
  key: 'retry-activation',
  label: 'website.retryActivation',
  icon: 'refresh',
  tooltip: 'website.retryActivationTooltip',
  request: {
    method: 'post',
    endpoint: (row) =>
      `${WEBSITE_ORDERS_ENDPOINT}/${encodeURIComponent(String(row['orderUUID'] ?? ''))}/activation/retry`,
    successMessage: 'website.activationRetried',
  },
};

/**
 * Website › Orders (tenant): offers contracted on the sites and in the customer portal, with the
 * first charge issued on the tenant's gateway. Approval offers wait here for "Approve". Paid orders
 * are activated by the platform (S5) or linked here to an existing server or hosting of the customer.
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
    const step = String(row['activationStep'] ?? '');
    return [
      ...(status === 'awaiting_approval' ? [APPROVE_ACTION] : []),
      ...(status === 'awaiting_approval' || status === 'awaiting_payment' ? [CANCEL_ACTION] : []),
      ...(LINKABLE.has(status)
        ? [row['kind'] === 'webhost' ? LINK_HOSTING_ACTION : LINK_SERVER_ACTION]
        : []),
      ...(status === 'provisioning' && RETRYABLE_STEPS.has(step) ? [RETRY_ACTION] : []),
      ...(row['refundStatus'] === 'pending' ? [REFUND_ACTION] : []),
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
