import { Component, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudSaveContext,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingPromotion, BillingService } from '../../shared/billing.service';
import {
  BILLING_STATUS_OPTIONS,
  BillingLookupState,
  DISCOUNT_APPLIES_TO_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
  PROMOTION_STACKING_OPTIONS,
  YES_NO_OPTIONS,
  cleanPayload,
  numberOrNull,
} from '../../shared/billing-crud';

const PROMOTION_PAYLOAD_KEYS = [
  'code',
  'name',
  'description',
  'currency',
  'requiresCoupon',
  'maxRedemptions',
  'maxRedemptionsPerTenant',
  'stackingPolicy',
  'eligibility',
  'isPublic',
  'startsAt',
  'endsAt',
  'status',
] as const;

const PROMOTION_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/billing/promotions',
  uuidField: 'BpmUUID',
  pageTitle: 'Billing promotions',
  pageDescription: 'Configure discounts, coupons and public commercial campaigns.',
  createTitle: 'New billing promotion',
  editTitle: 'Edit billing promotion',
  dialogDescription: 'Maintain promotion identity, eligibility and initial rule.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No billing promotions found.',
  deleteTitle: 'Delete billing promotion',
  deleteMessage: 'Delete this billing promotion?',
  deleteSelectedTitle: 'Delete selected billing promotions',
  deleteSelectedMessage: 'Delete {count} selected billing promotions?',
  savedMessage: 'Billing promotion saved successfully.',
  deletedMessage: 'Billing promotion deleted successfully.',
  deleteFailedMessage: 'Failed to delete billing promotion.',
  bulkDelete: false,
  ...BILLING_STATUS_OPTIONS,
  initialValues: {
    code: 'promo.',
    name: '',
    description: '',
    currency: 'BRL',
    requiresCoupon: 0,
    maxRedemptions: null,
    maxRedemptionsPerTenant: null,
    stackingPolicy: 'EXCLUSIVE',
    eligibility: '',
    isPublic: 0,
    startsAt: '',
    endsAt: '',
    ruleProductUUID: '',
    rulePriceUUID: '',
    discountType: 'PERCENT',
    appliesTo: 'ALL',
    discountValue: 0,
    cycles: null,
    couponCode: '',
    couponMaxUses: null,
    couponMaxUsesPerTenant: null,
    couponExpiresAt: '',
    status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'BpmName', uuidField: 'BpmUUID' },
    { id: 'code', label: 'Code', field: 'BpmCode' },
    { id: 'currency', label: 'Currency', field: 'BpmCurrency' },
    { id: 'rules', label: 'Rules', field: 'RuleCount' },
    { id: 'coupons', label: 'Coupons', field: 'CouponCount' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BpmStatus', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'BpmStatus', payloadKey: 'status', label: 'Status', type: 'status' },
    {
      key: 'code',
      source: 'BpmCode',
      payloadKey: 'code',
      label: 'Code',
      required: true,
      span: 1,
    },
    {
      key: 'stackingPolicy',
      source: 'BpmStackingPolicy',
      payloadKey: 'stackingPolicy',
      label: 'Stacking policy',
      type: 'select',
      options: PROMOTION_STACKING_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'currency',
      source: 'BpmCurrency',
      payloadKey: 'currency',
      label: 'Currency',
      required: true,
      span: 1,
    },
    {
      key: 'name',
      source: 'BpmName',
      payloadKey: 'name',
      label: 'Name',
      required: true,
      span: 2,
    },
    {
      key: 'requiresCoupon',
      source: 'BpmRequiresCoupon',
      payloadKey: 'requiresCoupon',
      label: 'Requires coupon',
      type: 'select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'isPublic',
      source: 'BpmIsPublic',
      payloadKey: 'isPublic',
      label: 'Public',
      type: 'select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'maxRedemptions',
      source: 'BpmMaxRedemptions',
      payloadKey: 'maxRedemptions',
      label: 'Max redemptions',
      type: 'number',
      span: 1,
    },
    {
      key: 'maxRedemptionsPerTenant',
      source: 'BpmMaxRedemptionsPerTenant',
      payloadKey: 'maxRedemptionsPerTenant',
      label: 'Max redemptions per tenant',
      type: 'number',
      span: 1,
    },
    {
      key: 'startsAt',
      source: 'BpmStartsAt',
      payloadKey: 'startsAt',
      label: 'Starts at',
      type: 'date',
      span: 1,
    },
    {
      key: 'endsAt',
      source: 'BpmEndsAt',
      payloadKey: 'endsAt',
      label: 'Ends at',
      type: 'date',
      span: 1,
    },
    {
      key: 'ruleProductUUID',
      payloadKey: 'ruleProductUUID',
      label: 'Rule product',
      type: 'search-select',
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 2,
    },
    {
      key: 'rulePriceUUID',
      payloadKey: 'rulePriceUUID',
      label: 'Rule price',
      type: 'search-select',
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 2,
    },
    {
      key: 'discountType',
      payloadKey: 'discountType',
      label: 'Discount type',
      type: 'select',
      options: DISCOUNT_TYPE_OPTIONS,
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'appliesTo',
      payloadKey: 'appliesTo',
      label: 'Applies to',
      type: 'select',
      options: DISCOUNT_APPLIES_TO_OPTIONS,
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'discountValue',
      payloadKey: 'discountValue',
      label: 'Discount value',
      type: 'number',
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'cycles',
      payloadKey: 'cycles',
      label: 'Cycles',
      type: 'number',
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'couponCode',
      payloadKey: 'couponCode',
      label: 'Coupon code',
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'couponMaxUses',
      payloadKey: 'couponMaxUses',
      label: 'Coupon max uses',
      type: 'number',
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'couponMaxUsesPerTenant',
      payloadKey: 'couponMaxUsesPerTenant',
      label: 'Coupon max uses per tenant',
      type: 'number',
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'couponExpiresAt',
      payloadKey: 'couponExpiresAt',
      label: 'Coupon expires at',
      type: 'date',
      hiddenWhen: ({ editing }) => editing,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'description',
      source: 'BpmDescription',
      payloadKey: 'description',
      label: 'Description',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 3,
    },
    {
      key: 'eligibility',
      source: 'BpmEligibilityJson',
      payloadKey: 'eligibility',
      label: 'Eligibility JSON',
      type: 'textarea',
      tab: 'notes',
      format: 'json',
      span: 4,
      rows: 4,
    },
  ],
};

@Component({
  selector: 'app-billing-system-promotions',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
})
export class BillingSystemPromotionsPage extends ConfigurableCrudPageBase<
  BillingPromotion & ConfigurableCrudRecord
> {
  private readonly billing = inject(BillingService);
  private readonly lookups = new BillingLookupState(this.billing);
  private pendingInitialRule: ConfigurableCrudRecord | null = null;

  constructor() {
    super(PROMOTION_CONFIG);
    void this.lookups.load();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'ruleProductUUID') return this.lookups.productOptions();
    if (key === 'rulePriceUUID') return this.lookups.priceOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    this.pendingInitialRule = {
      ruleProductUUID: payload['ruleProductUUID'],
      rulePriceUUID: payload['rulePriceUUID'],
      discountType: payload['discountType'],
      appliesTo: payload['appliesTo'],
      discountValue: payload['discountValue'],
      cycles: payload['cycles'],
      couponCode: payload['couponCode'],
      couponMaxUses: payload['couponMaxUses'],
      couponMaxUsesPerTenant: payload['couponMaxUsesPerTenant'],
      couponExpiresAt: payload['couponExpiresAt'],
    };
    const next = cleanPayload(payload, PROMOTION_PAYLOAD_KEYS);
    next['currency'] = String(next['currency'] ?? 'BRL').toUpperCase();
    next['maxRedemptions'] = numberOrNull(next['maxRedemptions']);
    next['maxRedemptionsPerTenant'] = numberOrNull(next['maxRedemptionsPerTenant']);
    return next;
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<BillingPromotion & ConfigurableCrudRecord>,
  ): Promise<void> {
    if (context.mode !== 'create') return;
    const response = context.response as { data?: { item?: BillingPromotion } };
    const promotionUUID = response?.data?.item?.BpmUUID;
    const values = this.pendingInitialRule ?? {};
    this.pendingInitialRule = null;
    if (!promotionUUID) return;

    if (values['ruleProductUUID'] || values['rulePriceUUID']) {
      await this.billing.createPromotionRule(promotionUUID, {
        productUUID: values['ruleProductUUID'] || null,
        priceUUID: values['rulePriceUUID'] || null,
        discountType: values['discountType'],
        appliesTo: values['appliesTo'],
        discountValue: numberOrNull(values['discountValue']) ?? 0,
        cycles: numberOrNull(values['cycles']),
        status: 1,
      });
    }

    if (String(values['couponCode'] ?? '').trim()) {
      await this.billing.createPromotionCoupon(promotionUUID, {
        code: values['couponCode'],
        maxUses: numberOrNull(values['couponMaxUses']),
        maxUsesPerTenant: numberOrNull(values['couponMaxUsesPerTenant']),
        expiresAt: values['couponExpiresAt'] || null,
        status: 1,
      });
    }
    this.refreshList();
  }
}
