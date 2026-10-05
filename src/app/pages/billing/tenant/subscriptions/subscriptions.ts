import { billingComposition, billingCycles } from '../../shared/billing-composition';
import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingService, BillingSubscription } from '../../shared/billing.service';
import { BILLING_STRING_STATUS_OPTIONS } from '../../shared/billing-crud';

const SUBSCRIPTIONS_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'billing/subscriptions',
  uuidField: 'BsuUUID',
  pageTitle: 'Billing subscriptions',
  pageDescription: 'Monitor and manage this tenant subscriptions.',
  createTitle: 'New subscription',
  editTitle: 'Edit subscription',
  dialogDescription: 'Maintain subscription.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No billing subscriptions found.',
  deleteTitle: 'Cancel subscription',
  deleteMessage: 'Cancel this subscription?',
  deleteSelectedTitle: 'Cancel selected subscriptions',
  deleteSelectedMessage: 'Cancel {count} selected subscriptions?',
  savedMessage: 'Subscription saved successfully.',
  deletedMessage: 'Subscription canceled successfully.',
  deleteFailedMessage: 'Failed to cancel subscription.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  serverSidePagination: true,
  rowActions: [
    ...[true, false].map((enabled): ConfigurableCrudRowAction => ({
      key: enabled ? 'enableRenewal' : 'disableRenewal',
      label: enabled ? 'Enable automatic renewal' : 'Disable automatic renewal',
      icon: enabled ? 'autorenew' : 'pause',
      visible: (row) =>
        ['ACTIVE', 'SUSPENDED'].includes(String(row['BsuStatus'])) &&
        row['BsuBillingScopeSnapshot'] === 'MODULE' &&
        ['MONTHLY', 'MODULE_MONTHLY'].includes(String(row['BsuBillingModeSnapshot'])) &&
        Boolean(Number(row['BsuAutoRenew'])) !== enabled,
      request: {
        method: 'post',
        endpoint: (row) => `billing/subscriptions/${row['BsuUUID']}/renewal`,
        body: () => ({ enabled }),
        successMessage: 'Renewal preference updated.',
        confirm: {
          title: enabled ? 'Enable automatic renewal' : 'Disable automatic renewal',
          message: enabled
            ? 'Renew automatically from the prepaid wallet at the contracted recurring price? An expired contract may be charged on the next processing pass.'
            : 'Stop automatic renewal after the current paid period?',
          confirmLabel: 'Confirm',
        },
      },
    })),
    {
      key: 'cycles',
      label: 'Paid cycles',
      icon: 'receipt_long',
      collection: (row) => billingCycles(`billing/subscriptions/${row['BsuUUID']}/cycles`),
    },
    {
      key: 'composition',
      label: 'Contracted composition',
      icon: 'list',
      collection: (row) =>
        billingComposition(`billing/subscriptions/${row['BsuUUID']}/items`, true),
    },
    {
      key: 'cancel',
      label: 'Cancel subscription',
      icon: 'block',
      visible: (row) =>
        ['ACTIVE', 'SUSPENDED', 'PENDING_PAYMENT', 'PENDING_CANCEL'].includes(
          String(row['BsuStatus']),
        ),
    },
  ],
  ...BILLING_STRING_STATUS_OPTIONS,
  initialValues: {},
  columns: [
    { id: 'autoRenew', label: 'Automatic renewal', field: 'BsuAutoRenew', kind: 'boolean' },
    { id: 'scheduled', label: 'Scheduled start', field: 'BsuScheduledStartAt', kind: 'datetime' },
    {
      id: 'nextAmount',
      label: 'Next cycle amount',
      field: 'NextCycleAmount',
      kind: 'currency',
      currencyField: 'BsuCurrency',
    },
    { id: 'product', label: 'Offer', kind: 'identity', field: 'OfferName', uuidField: 'BsuUUID' },
    { id: 'plan', label: 'Plan', field: 'BpcName' },
    {
      id: 'price',
      label: 'Price',
      kind: 'currency',
      field: 'BsuUnitPriceSnapshot',
      currencyField: 'BsuCurrency',
    },
    {
      id: 'quantity',
      label: 'Quantity',
      kind: 'number',
      field: 'BsuQuantity',
      maximumFractionDigits: 2,
    },
    { id: 'nextBill', label: 'Next bill at', kind: 'datetime', field: 'BsuNextBillAt' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BsuStatus', className: 'status-col' },
  ],
  fields: [],
};

@Component({
  selector: 'app-billing-tenant-subscriptions',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class BillingTenantSubscriptionsPage extends ConfigurableCrudPageBase<
  BillingSubscription & ConfigurableCrudRecord
> {
  private readonly billing = inject(BillingService);

  constructor() {
    super(SUBSCRIPTIONS_CONFIG);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: BillingSubscription & ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'cancel') return super.handleRowAction(action, row);
    const confirmed = await this.confirmAction(
      'Cancel subscription',
      'Cancel this subscription?',
      'Cancel subscription',
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      await this.billing.cancelSubscription(this.recordUUID(row));
      this.snack.success('Subscription canceled successfully.');
      this.refreshList();
    } catch {
      // Preserve the explicit rejection returned by the API interceptor.
    } finally {
      this.mutating.set(false);
    }
  }
}
