import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingSubscription } from '../../shared/billing.service';
import { BILLING_STRING_STATUS_OPTIONS } from '../../shared/billing-crud';

const SUBSCRIPTION_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/billing/subscriptions',
  uuidField: 'BsuUUID',
  pageTitle: 'Billing subscriptions',
  pageDescription: 'Monitor and cancel tenant commercial subscriptions.',
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
  rowActions: [{ key: 'cancel', label: 'Cancel subscription', icon: 'block' }],
  ...BILLING_STRING_STATUS_OPTIONS,
  initialValues: {},
  columns: [
    {
      id: 'product',
      label: 'Product',
      kind: 'identity',
      field: 'BprName',
      uuidField: 'BsuUUID',
    },
    { id: 'tenant', label: 'Tenant', field: 'EnvironmentName' },
    { id: 'price', label: 'Price', field: 'BpcName' },
    { id: 'quantity', label: 'Quantity', field: 'BsuQuantity' },
    { id: 'currency', label: 'Currency', field: 'BsuCurrency' },
    { id: 'nextBill', label: 'Next bill at', field: 'BsuNextBillAt' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BsuStatus', className: 'status-col' },
  ],
  fields: [],
};

@Component({
  selector: 'app-billing-system-subscriptions',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
})
export class BillingSystemSubscriptionsPage extends ConfigurableCrudPageBase<
  BillingSubscription & ConfigurableCrudRecord
> {
  constructor() {
    super(SUBSCRIPTION_CONFIG);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: BillingSubscription & ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'cancel') return;
    const confirmed = await this.confirmAction(
      'Cancel subscription',
      'Cancel this subscription?',
      'Cancel subscription',
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      await this.api.delete(`${SUBSCRIPTION_CONFIG.endpoint}/${this.recordUUID(row)}`);
      this.snack.success('Subscription canceled successfully.');
      this.refreshList();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to cancel subscription.');
    } finally {
      this.mutating.set(false);
    }
  }

  override rowActions(
    row: BillingSubscription & ConfigurableCrudRecord,
  ): readonly ConfigurableCrudRowAction[] {
    if (row.BsuStatus === 'CANCELED') return [];
    return SUBSCRIPTION_CONFIG.rowActions ?? [];
  }
}
