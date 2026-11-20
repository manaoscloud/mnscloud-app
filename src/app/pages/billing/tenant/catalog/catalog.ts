import { billingComposition } from '../../shared/billing-composition';
import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  BillingCatalogItem,
  BillingService,
  BillingSwitchPreview,
  billingTermOffers,
} from '../../shared/billing.service';
import { BILLING_STRING_STATUS_OPTIONS } from '../../shared/billing-crud';
import { openCrudComponentDialog } from '../../../../shared/dialog/crud-dialog.util';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';
import { BillingSwitchDialogComponent } from './switch-dialog';
import { BillingCheckoutDialogComponent, BillingCheckoutDialogResult } from './checkout-dialog';

const CATALOG_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'billing/catalog',
  uuidField: 'BpcUUID',
  pageTitle: 'Billing catalog',
  pageDescription: 'Review products available for this tenant.',
  createTitle: 'New catalog item',
  editTitle: 'Edit catalog item',
  dialogDescription: 'Maintain catalog item.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No catalog products found.',
  deleteTitle: 'Delete catalog item',
  deleteMessage: 'Delete this catalog item?',
  deleteSelectedTitle: 'Delete selected catalog items',
  deleteSelectedMessage: 'Delete {count} selected catalog items?',
  savedMessage: 'Catalog item saved successfully.',
  deletedMessage: 'Catalog item deleted successfully.',
  deleteFailedMessage: 'Failed to delete catalog item.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  serverSidePagination: true,
  rowActions: [
    {
      key: 'composition',
      label: 'Package composition',
      icon: 'list',
      visible: (row) => row['OfferType'] === 'PACKAGE',
      collection: (row) => billingComposition(`billing/catalog/${row['BpcUUID']}/items`, false),
    },
    {
      key: 'subscribe',
      label: 'Subscribe',
      icon: 'add_shopping_cart',
      inline: true,
      // A module already released by an active package is never offered again (no double billing).
      visible: (row) =>
        row['OfferBillingScope'] === 'MODULE' &&
        row['SubscriptionStatus'] === 'AVAILABLE' &&
        row['CoverageStatus'] !== 'INCLUDED',
    },
  ],
  ...BILLING_STRING_STATUS_OPTIONS,
  activeStatusValues: ['AVAILABLE', 'ACTIVE', 'PENDING_CANCEL'] as const,
  statusOptions: [
    { value: 'AVAILABLE', label: 'Available' },
    ...BILLING_STRING_STATUS_OPTIONS.statusOptions,
  ],
  initialValues: {},
  columns: [
    { id: 'offer', label: 'Offer', kind: 'identity', field: 'OfferName', uuidField: 'OfferUUID' },
    {
      id: 'offerType',
      label: 'Offer type',
      field: 'OfferType',
      value: (row, t) => t(row['OfferType'] === 'PACKAGE' ? 'Package' : 'Product'),
    },
    {
      id: 'coverage',
      label: 'Coverage',
      field: 'CoverageStatus',
      value: (row, t) =>
        t(row['CoverageStatus'] === 'INCLUDED' ? 'Included in a package' : 'Additional offer'),
    },
    { id: 'plan', label: 'Plan', field: 'BpcName' },
    {
      id: 'price',
      label: 'Price',
      kind: 'currency',
      field: 'BpcUnitPrice',
      currencyField: 'BpcCurrency',
    },
    { id: 'mode', label: 'Billing mode', field: 'BpcBillingMode', translateValue: true },
    {
      id: 'terms',
      label: 'Prepaid terms',
      value: (row, t) => {
        const terms = billingTermOffers(row);
        if (!terms.length) return '-';
        const best = terms.reduce((a, b) => (b.discountPercent > a.discountPercent ? b : a));
        return `${t('Up to')} ${Number(best.discountPercent)}% (${best.months} ${t('months')})`;
      },
    },
    { id: 'promotion', label: 'Promotion', field: 'PromotionName' },
    {
      id: 'subscriptionStatus',
      label: 'Subscription status',
      kind: 'status',
      field: 'SubscriptionStatus',
      className: 'status-col',
    },
  ],
  fields: [],
};

@Component({
  selector: 'app-billing-tenant-catalog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class BillingTenantCatalogPage extends ConfigurableCrudPageBase<
  BillingCatalogItem & ConfigurableCrudRecord
> {
  private readonly checkoutKeys = new Map<string, string>();
  private readonly billing = inject(BillingService);

  constructor() {
    super(CATALOG_CONFIG);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: BillingCatalogItem & ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'subscribe') return super.handleRowAction(action, row);
    if (this.mutating()) return;
    const priceUUID = this.recordUUID(row);

    // The API quotes the offer against the current contracts; a paid entitlement is never billed twice.
    let preview: BillingSwitchPreview | null;
    this.mutating.set(true);
    try {
      preview = await this.billing.switchPreview(priceUUID, String(row.OfferType), row.OfferUUID);
    } catch {
      // The API interceptor already presents the server-side billing rejection.
      return;
    } finally {
      this.mutating.set(false);
    }
    const isSwitch = Boolean(preview && preview.contracts.length);
    const offerName = String(row['OfferName'] ?? '');
    let checkout: BillingCheckoutDialogResult | null = null;
    if (isSwitch) {
      if (!(await this.confirmSwitch(offerName, preview!))) return;
    } else {
      // New subscription: the tenant chooses monthly or a discounted prepaid term, and may use a coupon.
      checkout = await this.chooseCheckout(offerName, priceUUID, row);
      if (!checkout) return;
    }

    this.mutating.set(true);
    try {
      // A switch confirmation is a different request than a plain checkout, so it gets its own key.
      const requestKey = `${localStorage.getItem('mc_current_env')}:${priceUUID}:${isSwitch ? preview!.quotedAt : ''}:${checkout?.termMonths ?? ''}:${checkout?.promotionCode ?? ''}`;
      const idempotencyKey = this.checkoutKeys.get(requestKey) ?? crypto.randomUUID();
      this.checkoutKeys.set(requestKey, idempotencyKey);
      await this.billing.createSubscription({
        priceUUID,
        offerType: row.OfferType,
        offerUUID: row.OfferUUID,
        idempotencyKey,
        ...(checkout && checkout.termMonths > 1 ? { termMonths: checkout.termMonths } : {}),
        ...(checkout?.promotionCode ? { promotionCode: checkout.promotionCode } : {}),
        ...(isSwitch
          ? { switch: { quotedAt: preview!.quotedAt, expectedCredit: preview!.creditAmount } }
          : {}),
      });
      this.checkoutKeys.delete(requestKey);
      this.snack.success(
        preview?.mode === 'SCHEDULED'
          ? 'Plan change scheduled.'
          : preview?.contracts.some((c) => c.coverage !== 'INFO')
            ? 'Plan switched.'
            : 'Subscription created.',
      );
      this.refreshList();
    } catch {
      // The API interceptor already presents the server-side billing rejection.
      // Do not overwrite it with a generic message here.
    } finally {
      this.mutating.set(false);
    }
  }

  private chooseCheckout(
    offerName: string,
    priceUUID: string,
    row: BillingCatalogItem & ConfigurableCrudRecord,
  ): Promise<BillingCheckoutDialogResult | null> {
    return new Promise((resolve) => {
      const binding = openCrudComponentDialog(
        this.dialog,
        BillingCheckoutDialogComponent,
        'crud-form-dialog',
        {
          data: {
            offerName,
            priceUUID,
            offerType: String(row.OfferType),
            offerUUID: row.OfferUUID,
            terms: ['MONTHLY', 'MODULE_MONTHLY'].includes(String(row['BpcBillingMode']))
              ? billingTermOffers(row)
              : [],
          },
          onEscape: () => binding.ref.close(null),
        },
      );
      bindDialogClosed(
        binding.ref,
        (result) => {
          binding.stop();
          resolve((result as BillingCheckoutDialogResult | null) ?? null);
        },
        this.destroyRef,
      );
    });
  }

  private confirmSwitch(offerName: string, preview: BillingSwitchPreview): Promise<boolean> {
    return new Promise((resolve) => {
      const binding = openCrudComponentDialog(
        this.dialog,
        BillingSwitchDialogComponent,
        'crud-form-dialog',
        { data: { offerName, preview }, onEscape: () => binding.ref.close(false) },
      );
      bindDialogClosed(
        binding.ref,
        (confirmed) => {
          binding.stop();
          resolve(confirmed === true);
        },
        this.destroyRef,
      );
    });
  }
}
