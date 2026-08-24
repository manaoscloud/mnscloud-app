import {
  ConfigurableCrudOption,
  ConfigurableCrudQuickCreateConfig,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { CUSTOMER_CONFIG } from './customer';

export function customerQuickCreateConfig(): ConfigurableCrudQuickCreateConfig {
  return {
    label: 'Create customer',
    title: 'New customer',
    description: 'Create a customer without leaving the current form.',
    config: CUSTOMER_CONFIG,
    optionFromResponse: customerOptionFromResponse,
  };
}

export function customerOptionFromResponse(
  response: unknown,
  payload: ConfigurableCrudRecord,
): ConfigurableCrudOption | null {
  const record = extractRecord(response);
  const value = String(
    record['CustomerUUID'] ??
      record['CusUUID'] ??
      record['CustomerCusUUID'] ??
      record['uuid'] ??
      '',
  ).trim();
  if (!value) return null;

  const label = String(
    record['Name'] ??
      record['CusName'] ??
      record['CustomerName'] ??
      payload['name'] ??
      payload['legalName'] ??
      value,
  ).trim();
  const description = [
    record['Document'] ?? record['CusDocument'] ?? payload['document'],
    record['Email'] ?? record['CusEmail'] ?? payload['email'],
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .join(' - ');

  return {
    value,
    label: label || value,
    description,
    searchText: `${label} ${description} ${value}`,
  };
}

function extractRecord(response: unknown): ConfigurableCrudRecord {
  const value = response as
    | {
        data?: unknown;
        item?: unknown;
        record?: unknown;
      }
    | null
    | undefined;
  const data = value?.data as
    | {
        item?: unknown;
        record?: unknown;
        data?: unknown;
      }
    | ConfigurableCrudRecord
    | null
    | undefined;

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const wrapped = data as { item?: unknown; record?: unknown; data?: unknown };
    for (const candidate of [wrapped.item, wrapped.record, wrapped.data, data]) {
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        return candidate as ConfigurableCrudRecord;
      }
    }
  }
  for (const candidate of [value?.item, value?.record]) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as ConfigurableCrudRecord;
    }
  }
  return {};
}
