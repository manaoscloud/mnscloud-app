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
    ...(['SAME_TERM', 'MONTHLY'] as const).map((policy): ConfigurableCrudRowAction => ({
      key: policy === 'SAME_TERM' ? 'termRenewSame' : 'termRenewMonthly',
      label: policy === 'SAME_TERM' ? 'Renew for the same term' : 'Continue monthly after the term',
      icon: policy === 'SAME_TERM' ? 'event_repeat' : 'calendar_view_month',
      visible: (row) =>
        Boolean(row['BsuTermStartAt']) &&
        ['ACTIVE', 'SUSPENDED', 'PENDING_CANCEL'].includes(String(row['BsuStatus'])) &&
        String(row['BsuTermRenewalPolicy'] ?? 'SAME_TERM') !== policy,
      request: {
        method: 'post',
        endpoint: (row) => `billing/subscriptions/${row['BsuUUID']}/term-renewal`,
        body: () => ({ policy }),
        successMessage: 'Renewal preference updated.',
        confirm: {
          title:
            policy === 'SAME_TERM' ? 'Renew for the same term' : 'Continue monthly after the term',
          message:
            policy === 'SAME_TERM'
              ? 'At the end of the term, prepay the same term again at its discount, charged from the prepaid wallet.'
              : 'At the end of the term, continue monthly at the full monthly price, charged from the prepaid wallet.',
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
      id: 'term',
      label: 'Prepaid term',
      value: (row, t) => {
        const months = Number(row['BsuTermMonths'] ?? 1);
        if (!row['BsuTermStartAt'] || months <= 1) return t('Monthly');
        const discount = Number(row['BsuTermDiscountPercentSnapshot'] ?? 0);
        return `${months} ${t('months')}${discount > 0 ? ` (-${discount}%)` : ''}`;
      },
    },
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
    {
      id: 'blocksReleased',
      label: 'Blocks at / Released at',
      value: (row, t) => {
        if (row['BsuStatus'] !== 'SUSPENDED') return '-';
        const block = row['BlockAt'] ? String(row['BlockAt']).slice(0, 10) : null;
        const release = row['ReleaseAt'] ? String(row['ReleaseAt']).slice(0, 10) : null;
        if (!block && !release) return '-';
        const parts: string[] = [];
        if (block) parts.push(`${t('Blocks at')} ${block}`);
        if (release) parts.push(`${t('Released at')} ${release}`);
        return parts.join(' / ');
      },
    },
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

  private money(value: number, currency: string): string {
    const code = /^[A-Z]{3}$/.test(currency) ? currency : 'BRL';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(
        Number(value) || 0,
      );
    } catch {
      return `${code} ${(Number(value) || 0).toFixed(2)}`;
    }
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: BillingSubscription & ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'cancel') return super.handleRowAction(action, row);
    // Prepaid terms: the server says what canceling now returns to the wallet.
    let message = 'Cancel this subscription?';
    try {
      const preview = await this.billing.cancelPreview(this.recordUUID(row));
      if (preview?.mode === 'WITHDRAWAL') {
        message = this.t(
          'You are within 7 days of the purchase: the whole term and the setup ({{amount}}) return to your prepaid balance and the service ends now.',
          { amount: this.money(preview.creditAmount, preview.currency) },
        );
      } else if (preview?.mode === 'EARLY') {
        message = this.t(
          'The months used are recalculated at the discount of the term you completed; {{amount}} returns to your prepaid balance and the service continues until {{date}}.',
          {
            amount: this.money(preview.creditAmount, preview.currency),
            date: String(preview.effectiveAt ?? '').slice(0, 10),
          },
        );
      }
    } catch {
      // The API interceptor presents the rejection; the plain confirmation still applies.
    }
    const confirmed = await this.confirmAction(
      'Cancel subscription',
      message,
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
