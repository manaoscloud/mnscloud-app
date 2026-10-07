import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';

/** Scope is selected by the guarded route; API authorization remains authoritative. */
export function dnsCrudConfig(
  config: ConfigurableCrudConfig,
  master: boolean,
): ConfigurableCrudConfig {
  const prefix = master ? 'system/hosting/dns' : 'hosting/dns';
  const lookups: Record<string, ConfigurableCrudField['remoteLookup']> = {
    customerUUID: {
      endpoint: 'erp/customers?status=1',
      uuidField: 'CustomerUUID',
      labelField: 'Name',
      selectedLabelField: 'CustomerName',
    },
    providerUUID: {
      endpoint: `${prefix}/providers?status=1`,
      uuidField: 'HdpUUID',
      labelField: 'HdpName',
      selectedLabelField: 'ProviderName',
    },
    registerUUID: {
      endpoint: `${prefix}/registers?availableFor=domain&status=1`,
      uuidField: 'HrgUUID',
      labelField: 'HrgName',
      selectedLabelField: 'RegisterName',
      ...(master ? {} : { parameters: { customerUUID: 'customerUUID' } }),
    },
  };
  const routeData = { scope: master ? 'master' : 'tenant', context: master ? 'system' : 'hosting' };
  return {
    ...config,
    ...(master && config.endpoint.endsWith('/registers')
      ? {
          pageDescription: 'Manage platform domain registrations and registrar metadata.',
          dialogDescription: 'Store the platform domain name, registrar and notes.',
        }
      : {}),
    endpoint: master ? `system/${config.endpoint}` : config.endpoint,
    columns: config.columns.filter((column) => !master || column.id !== 'customer'),
    listFilters: config.listFilters
      ?.filter((field) => !master || !['customerUUID', 'pabxPolicyPlatform'].includes(field.key))
      .map((field) => ({
        ...field,
        span: 1 as const,
        ...(lookups[field.key] ? { remoteLookup: lookups[field.key] } : {}),
      })),
    fields: config.fields
      .filter((field) => !master || !['customerUUID', 'pabxPolicyPlatform'].includes(field.key))
      .map((field) => ({
        ...field,
        ...(lookups[field.key] ? { remoteLookup: lookups[field.key] } : {}),
        ...(field.key === 'registerUUID'
          ? { quickCreate: quickCreateFor('HostingDnsRegisterHrgUUID', { routeData }) }
          : {}),
        ...(field.key === 'providerUUID'
          ? { quickCreate: quickCreateFor('HostingDnsProviderHdpUUID', { routeData }) }
          : {}),
      })),
  };
}
