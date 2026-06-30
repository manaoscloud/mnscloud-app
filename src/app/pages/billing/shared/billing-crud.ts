import { signal } from '@angular/core';

import {
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  BillingPrice,
  BillingProduct,
  BillingProductDefinition,
  BillingService,
} from './billing.service';

export const BILLING_STATUS_OPTIONS = {
  statusMode: 'number' as const,
  activeValue: 1,
  inactiveValue: 0,
};

export const BILLING_STRING_STATUS_OPTIONS = {
  statusMode: 'string' as const,
  activeValue: 'ACTIVE',
  inactiveValue: 'CANCELED',
};

export const BILLING_SCOPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'MODULE', label: 'Module' },
  { value: 'RESOURCE', label: 'Resource' },
  { value: 'USAGE', label: 'Usage' },
];

export const BILLING_MODE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'ONE_TIME', label: 'One-time' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'USAGE', label: 'Usage' },
  { value: 'PREPAID', label: 'Prepaid' },
];

export const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

export const PROMOTION_STACKING_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'EXCLUSIVE', label: 'Exclusive' },
  { value: 'STACKABLE', label: 'Stackable' },
];

export const DISCOUNT_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'PERCENT', label: 'Percent' },
  { value: 'AMOUNT', label: 'Amount' },
];

export const DISCOUNT_APPLIES_TO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SETUP', label: 'Setup' },
  { value: 'RECURRING', label: 'Recurring' },
];

export class BillingLookupState {
  readonly products = signal<BillingProduct[]>([]);
  readonly prices = signal<BillingPrice[]>([]);
  readonly definitions = signal<BillingProductDefinition[]>([]);
  readonly loading = signal(false);

  constructor(private readonly billing: BillingService) {}

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [products, prices, definitions] = await Promise.all([
        this.billing.listProducts('', 1),
        this.billing.listPrices('', '', 1),
        this.billing.listProductDefinitions('', 1),
      ]);
      this.products.set(products);
      this.prices.set(prices);
      this.definitions.set(definitions);
    } finally {
      this.loading.set(false);
    }
  }

  productOptions(): readonly ConfigurableCrudOption[] {
    return this.products().map((product) => ({
      value: product.BprUUID,
      label: product.BprName || product.BprCode,
    }));
  }

  productDefinitionCodeOptions(): readonly ConfigurableCrudOption[] {
    return this.definitions().map((definition) => ({
      value: definition.BpdCode,
      label: `${definition.BpdCode} - ${definition.BpdName}`,
    }));
  }

  priceOptions(): readonly ConfigurableCrudOption[] {
    return this.prices().map((price) => ({
      value: price.BpcUUID,
      label: `${price.BpcName} - ${price.BprName ?? price.BprCode ?? ''}`.trim(),
    }));
  }

  productLabel(uuid: unknown): string {
    return this.products().find((product) => product.BprUUID === uuid)?.BprName ?? '';
  }

  priceLabel(uuid: unknown): string {
    return this.prices().find((price) => price.BpcUUID === uuid)?.BpcName ?? '';
  }
}

export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function cleanPayload(
  payload: ConfigurableCrudRecord,
  allowedKeys: readonly string[],
): ConfigurableCrudRecord {
  const next: ConfigurableCrudRecord = {};
  for (const key of allowedKeys) next[key] = payload[key];
  return next;
}
