import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudRecord,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../../shared/crud/configurable-crud/define-crud';

function object(value: unknown): ConfigurableCrudRecord {
  if (value === null || value === undefined || value === '') return {};
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Enter a valid JSON object.');
  return parsed as ConfigurableCrudRecord;
}
const configKeys = [
  'sandbox',
  'scope',
  'apiBaseUrl',
  'tokenUrl',
  'createChargePath',
  'getChargePathTemplate',
];
const secretKeys = ['clientId', 'clientSecret', 'certPem', 'keyPem'];

/**
 * Tenant payment gateways (ERP). Independent from MNSCloud Pay bank partners, which live under
 * System > Pay > Bank partners. API seals secrets and enforces tenant scope.
 */
export function paymentGatewayConfig(): ConfigurableCrudConfig {
  const prefix = 'Efg';
  const fields: ConfigurableCrudField[] = [
    {
      key: 'status',
      source: 'EfgIsActive',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    { key: 'name', source: prefix + 'Name', label: 'Name', required: true, span: 1 },
    {
      key: 'isDefault',
      source: prefix + 'IsDefault',
      label: 'Default',
      type: 'select',
      span: 1,
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
    },
    {
      key: 'advanced',
      label: 'Configuration mode',
      type: 'select',
      span: 1,
      options: [
        { value: false, label: 'Form' },
        { value: true, label: 'Advanced JSON' },
      ],
    },
    {
      key: 'configJson',
      source: prefix + 'Config',
      label: 'Configuration JSON',
      type: 'textarea',
      format: 'json',
      span: 4,
      rows: 8,
      tab: 'network',
      hiddenWhen: ({ values }) => !values['advanced'],
    },
    {
      key: 'credentialsJson',
      label: 'Credentials JSON',
      type: 'secret-content',
      format: 'json',
      span: 4,
      tab: 'authentication',
      hiddenWhen: ({ values }) => !values['advanced'],
      requiredWhen: ({ editing }) => !editing,
      hint: 'Leave credentials empty to keep the stored secret.',
    },
  ];
  const definitions: [string, string, ConfigurableCrudField['type']][] = [
    ['sandbox', 'Sandbox', 'select'],
    ['scope', 'OAuth Scope', 'text'],
    ['apiBaseUrl', 'API Base URL', 'text'],
    ['tokenUrl', 'Token URL', 'text'],
    ['createChargePath', 'Create Charge Path', 'text'],
    ['getChargePathTemplate', 'Get Charge Path Template', 'text'],
    ['clientId', 'Client ID', 'password'],
    ['clientSecret', 'Client Secret', 'password'],
    ['certPem', 'Certificate PEM', 'secret-content'],
    ['keyPem', 'Private Key PEM', 'secret-content'],
  ];
  for (const [key, label, type] of definitions) {
    const secret = secretKeys.includes(key);
    fields.push({
      key,
      label,
      type,
      span: type === 'secret-content' ? 4 : 1,
      tab: secret ? 'authentication' : 'network',
      hiddenWhen: ({ values }) => Boolean(values['advanced']),
      requiredWhen: ({ editing }) => !editing && (secret || key === 'scope'),
      ...(secret
        ? { fromRecord: () => '' }
        : { source: prefix + 'Config', fromRecord: (value: unknown) => object(value)[key] ?? '' }),
      ...(key === 'sandbox'
        ? {
            options: [
              { value: false, label: 'No' },
              { value: true, label: 'Yes' },
            ],
          }
        : {}),
    });
  }
  return defineCrud({
    serverSidePagination: true,
    endpoint: 'erp/financial/payment/gateways',
    uuidField: prefix + 'UUID',
    pageTitle: 'Payment Providers',
    canDelete: true,
    bulkDelete: true,
    statusOptions: [
      { value: 1, label: 'Active' },
      { value: 0, label: 'Inactive' },
    ],
    initialValues: {
      name: '',
      status: 1,
      isDefault: 0,
      advanced: false,
      sandbox: false,
      scope: 'boleto-cobranca.read boleto-cobranca.write',
    },
    fields,
    columns: [
      { id: 'name', label: 'Name', field: prefix + 'Name', kind: 'identity' },
      {
        id: 'provider',
        label: 'Payment provider',
        field: prefix + 'Provider',
        options: [{ value: 'inter_business', label: 'Pay' }],
      },
      { id: 'default', label: 'Default', field: prefix + 'IsDefault', kind: 'boolean' },
      {
        id: 'status',
        label: 'Status',
        field: 'EfgIsActive',
        kind: 'status',
      },
    ],
    rowActions: [{ key: 'validate', label: 'Validate connection', icon: 'verified' }],
    fieldChange: (key, value, current) => {
      if (key !== 'advanced' || value === current['advanced']) return { ...current, [key]: value };
      const next = { ...current, advanced: value };
      const config = object(current['configJson']);
      if (value) {
        for (const field of configKeys) {
          if (current[field] !== '' && current[field] !== undefined && current[field] !== null)
            config[field] = current[field];
          else delete config[field];
        }
        const credentials = Object.fromEntries(
          secretKeys.filter((field) => current[field]).map((field) => [field, current[field]]),
        );
        return {
          ...next,
          configJson: JSON.stringify(config, null, 2),
          credentialsJson: Object.keys(credentials).length
            ? JSON.stringify(credentials, null, 2)
            : '',
        };
      }
      const credentials = object(current['credentialsJson']);
      return {
        ...next,
        ...Object.fromEntries(configKeys.map((field) => [field, config[field] ?? ''])),
        ...Object.fromEntries(secretKeys.map((field) => [field, credentials[field] ?? ''])),
      };
    },
    payload: (v) => {
      const config = object(v['configJson']);
      const credentials = v['advanced'] ? object(v['credentialsJson']) : {};
      if (!v['advanced']) {
        for (const key of configKeys) {
          if (v[key] !== null && v[key] !== undefined && v[key] !== '') config[key] = v[key];
          else delete config[key];
        }
        for (const key of secretKeys) if (v[key]) credentials[key] = v[key];
      }
      if (
        Object.keys(credentials).length &&
        secretKeys.some((key) => !String(credentials[key] ?? '').trim())
      ) {
        throw new Error('Provide all credential fields to replace the stored secret.');
      }
      return {
        name: v['name'],
        provider: 'pay',
        bankPartner: 'inter_business',
        isDefault: Number(v['isDefault']) === 1,
        isActive: Number(v['status']) === 1,
        config: { ...config, productMethod: 'pay', bankPartner: 'inter_business' },
        ...(Object.keys(credentials).length ? { credentials } : {}),
      };
    },
  });
}
