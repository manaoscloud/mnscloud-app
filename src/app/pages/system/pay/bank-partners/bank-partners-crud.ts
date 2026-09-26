import {
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

/**
 * MNSCloud Pay bank partners: connections to the banks behind the platform product.
 * The bank list comes from the API catalog; each bank shows only the fields its API needs.
 */
export const INTER = 'inter_business';

const statusOptions: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];
const environmentOptions: readonly ConfigurableCrudOption[] = [
  { value: 'production', label: 'Production' },
  { value: 'sandbox', label: 'Sandbox' },
];
const receiveMethodOptions: readonly ConfigurableCrudOption[] = [
  { value: 'BOLETO,PIX', label: 'Boleto and Pix' },
  { value: 'BOLETO', label: 'Boleto only' },
  { value: 'PIX', label: 'Pix only' },
];
/** Purposes of a platform bank connection; only one connection per purpose is active. */
export const purposeOptions: readonly ConfigurableCrudOption[] = [
  { value: 'TENANT_BILLING', label: 'Tenant billing' },
  { value: 'PAY_SPLIT', label: 'MNSCloud Pay (split)' },
];
const webhookStatusOptions: readonly ConfigurableCrudOption[] = [
  { value: 'NOT_REGISTERED', label: 'Not registered' },
  { value: 'REGISTERED', label: 'Registered' },
  { value: 'FAILED', label: 'Failed' },
];
export const ASAAS = 'asaas';

/** Subset of the API bank partner catalog the form needs (GET /system/pay/bank-partners). */
export type BankPartnerDefinition = {
  code: string;
  name: string;
  purposes?: string[];
  requiresAccountNumber?: boolean;
  receiveMethods?: string[];
  autoCancelDays?: { min: number; max: number; default: number };
  credentials: { key: string; kind: 'text' | 'secret' | 'file'; required: boolean }[];
};

/**
 * Bank definitions keyed by code. Seeded with the known connectors so the form works before the
 * catalog loads; the page replaces them with the API catalog (the source of truth).
 */
export const bankDefinitions = new Map<string, BankPartnerDefinition>([
  [
    INTER,
    {
      code: INTER,
      name: 'Inter Empresas',
      purposes: ['TENANT_BILLING'],
      requiresAccountNumber: true,
      receiveMethods: ['BOLETO,PIX', 'BOLETO', 'PIX'],
      autoCancelDays: { min: 0, max: 60, default: 30 },
      credentials: [
        { key: 'clientId', kind: 'text', required: true },
        { key: 'clientSecret', kind: 'secret', required: true },
        { key: 'certPem', kind: 'file', required: true },
        { key: 'keyPem', kind: 'file', required: true },
        { key: 'webhookCaPem', kind: 'file', required: false },
      ],
    },
  ],
  [
    ASAAS,
    {
      code: ASAAS,
      name: 'Asaas',
      purposes: ['PAY_SPLIT'],
      credentials: [{ key: 'apiKey', kind: 'secret', required: true }],
    },
  ],
]);

/** Fallback until the catalog loads; the API remains the source of truth. */
export const defaultBankOptions: readonly ConfigurableCrudOption[] = [
  { value: INTER, label: 'Inter Empresas' },
  { value: ASAAS, label: 'Asaas' },
];

export const PEM_FIELDS = ['certPem', 'keyPem', 'webhookCaPem'] as const;
const CREDENTIAL_FIELDS = ['apiKey', 'clientId', 'clientSecret', ...PEM_FIELDS] as const;

type FieldContext = { editing: boolean; values: ConfigurableCrudRecord };
const bankOf = (values: ConfigurableCrudRecord) =>
  bankDefinitions.get(String(values['provider'] ?? ''));
const credentialOf = (values: ConfigurableCrudRecord, key: string) =>
  bankOf(values)?.credentials.find((field) => field.key === key);
/** Settings the selected bank declares; the others are hidden and never sent. */
const declares = (values: ConfigurableCrudRecord, setting: string) => {
  const bank = bankOf(values);
  if (!bank) return false;
  if (setting === 'accountNumber') return Boolean(bank.requiresAccountNumber);
  if (setting === 'receiveMethods') return Boolean(bank.receiveMethods?.length);
  if (setting === 'autoCancelDays') return Boolean(bank.autoCancelDays);
  return Boolean(credentialOf(values, setting));
};
const hiddenUnless = (setting: string) => ({ values }: FieldContext) => !declares(values, setting);
const requiredSetting = (setting: string) => ({ values }: FieldContext) => declares(values, setting);
const requiredOnCreate = (key: string) => ({ editing, values }: FieldContext) =>
  !editing && Boolean(credentialOf(values, key)?.required);
const keepSecretHint = ({ editing }: { editing: boolean }) =>
  editing ? 'Leave empty to keep the stored credentials. Replacing requires all fields.' : '';

const fields: ConfigurableCrudField[] = [
  {
    key: 'status',
    source: 'PbcStatus',
    label: 'Status',
    type: 'status',
    span: 1,
    options: statusOptions,
    hint: 'Activating this connection deactivates the other active connection of the same purpose.',
  },
  {
    key: 'provider',
    source: 'PbcProvider',
    label: 'Bank',
    type: 'select',
    span: 1,
    required: true,
    disabledWhen: ({ editing }) => editing,
    translateOptions: false,
  },
  { key: 'name', source: 'PbcName', label: 'Name', required: true, span: 1 },
  {
    key: 'environment',
    source: 'PbcEnvironment',
    label: 'Environment',
    type: 'select',
    span: 1,
    required: true,
    options: environmentOptions,
    hiddenWhen: ({ values }: FieldContext) => !bankOf(values),
  },
  {
    key: 'purpose',
    source: 'PbcPurpose',
    label: 'Purpose',
    type: 'select',
    span: 1,
    required: true,
    hint: 'Tenant billing: wallet top-ups and tenant invoices. MNSCloud Pay (split): charges issued by tenants to their customers.',
  },
  {
    key: 'accountNumber',
    source: 'PbcAccountNumber',
    label: 'Checking account',
    tab: 'financial',
    span: 1,
    requiredWhen: requiredSetting('accountNumber'),
    autocomplete: 'off',
    hint: 'Inter checking account number (x-conta-corrente).',
    hiddenWhen: hiddenUnless('accountNumber'),
  },
  {
    key: 'receiveMethods',
    source: 'PbcReceiveMethods',
    label: 'Receive methods',
    type: 'select',
    tab: 'financial',
    span: 1,
    requiredWhen: requiredSetting('receiveMethods'),
    options: receiveMethodOptions,
    hiddenWhen: hiddenUnless('receiveMethods'),
  },
  {
    key: 'autoCancelDays',
    source: 'PbcAutoCancelDays',
    label: 'Days to cancel after due date',
    type: 'number',
    tab: 'financial',
    span: 1,
    requiredWhen: requiredSetting('autoCancelDays'),
    hint: 'Between 0 and 60 days. After this period the bank cancels the unpaid charge.',
    hiddenWhen: hiddenUnless('autoCancelDays'),
  },
  {
    key: 'apiKey',
    label: 'API Key',
    type: 'password',
    tab: 'authentication',
    span: 4,
    autocomplete: 'new-password',
    translateLabel: false,
    fromRecord: () => '',
    requiredWhen: requiredOnCreate('apiKey'),
    hintWhen: keepSecretHint,
    hiddenWhen: hiddenUnless('apiKey'),
  },
  {
    key: 'clientId',
    label: 'Client ID',
    tab: 'authentication',
    span: 2,
    autocomplete: 'off',
    translateLabel: false,
    fromRecord: () => '',
    requiredWhen: requiredOnCreate('clientId'),
    hintWhen: keepSecretHint,
    hiddenWhen: hiddenUnless('clientId'),
  },
  {
    key: 'clientSecret',
    label: 'Client Secret',
    type: 'password',
    tab: 'authentication',
    span: 2,
    autocomplete: 'new-password',
    translateLabel: false,
    fromRecord: () => '',
    requiredWhen: requiredOnCreate('clientSecret'),
    hiddenWhen: hiddenUnless('clientSecret'),
  },
  {
    key: 'certPem',
    label: 'Certificate (.crt)',
    type: 'file',
    accept: '.crt,.pem',
    tab: 'authentication',
    span: 2,
    fromRecord: () => '',
    requiredWhen: requiredOnCreate('certPem'),
    hiddenWhen: hiddenUnless('certPem'),
  },
  {
    key: 'keyPem',
    label: 'Private key (.key)',
    type: 'file',
    accept: '.key,.pem',
    tab: 'authentication',
    span: 2,
    fromRecord: () => '',
    requiredWhen: requiredOnCreate('keyPem'),
    hiddenWhen: hiddenUnless('keyPem'),
  },
  {
    key: 'webhookCaPem',
    label: 'Webhook CA certificate (ca.crt)',
    type: 'file',
    accept: '.crt,.pem',
    tab: 'authentication',
    span: 2,
    fromRecord: () => '',
    hint: 'Optional. Inter: Minhas integrações > Certificado Webhook.',
    hiddenWhen: hiddenUnless('webhookCaPem'),
  },
];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

export const bankPartnersConfig = defineCrud({
  serverSidePagination: true,
  endpoint: 'system/pay/bank-connections',
  uuidField: 'PbcUUID',
  pageTitle: 'Pay — Bank Partners',
  pageDescription: 'Bank connections that issue and settle MNSCloud Pay charges.',
  createTitle: 'New bank connection',
  editTitle: 'Edit bank connection',
  dialogDescription: 'Select the bank; only the fields its integration requires are shown.',
  searchPlaceholder: 'Name, bank or account',
  emptyLabel: 'No bank connections found.',
  savedMessage: 'Bank connection saved.',
  // Platform bank connections have no delete contract; deactivate them instead.
  canDelete: false,
  bulkDelete: false,
  statusOptions,
  tabLabels: {
    record: 'Identification',
    financial: 'Account and charges',
    authentication: 'Credentials',
  },
  initialValues: {
    status: 1,
    provider: INTER,
    name: '',
    environment: 'production',
    purpose: 'TENANT_BILLING',
    accountNumber: '',
    receiveMethods: 'BOLETO,PIX',
    autoCancelDays: 30,
    apiKey: '',
    clientId: '',
    clientSecret: '',
    certPem: '',
    keyPem: '',
    webhookCaPem: '',
  },
  fields,
  columns: [
    { id: 'name', label: 'Name', field: 'PbcName', kind: 'identity' },
    { id: 'purpose', label: 'Purpose', field: 'PbcPurpose', options: purposeOptions },
    {
      id: 'provider',
      label: 'Bank',
      field: 'PbcProvider',
      options: defaultBankOptions,
      translateValue: false,
    },
    {
      id: 'environment',
      label: 'Environment',
      field: 'PbcEnvironment',
      options: environmentOptions,
    },
    { id: 'account', label: 'Checking account', field: 'PbcAccountNumber', kind: 'text' },
    {
      id: 'certificate',
      label: 'Certificate expires',
      field: 'PbcCertificateExpiresAt',
      kind: 'date',
    },
    {
      id: 'webhook',
      label: 'Settlement webhook',
      field: 'PbcWebhookStatus',
      options: webhookStatusOptions,
    },
    {
      id: 'files',
      label: 'Certificate stored',
      field: 'PbcCredentialFilesStored',
      kind: 'boolean',
    },
    { id: 'status', label: 'Status', field: 'PbcStatus', kind: 'status' },
  ],
  rowActions: [
    { key: 'validate', label: 'Validate connection', icon: 'verified' },
    { key: 'webhook', label: 'Register settlement webhook', icon: 'webhook' },
  ],
  payload: (values, editing) => {
    const bank = bankOf(values);
    const credentials: Record<string, string> = {};
    for (const key of CREDENTIAL_FIELDS) {
      const value = text(values[key]);
      if (value && credentialOf(values, key)) credentials[key] = value;
    }
    const replacing = Object.keys(credentials).length > 0;
    const required = (bank?.credentials ?? []).filter((field) => field.required).map((f) => f.key);
    if (replacing && required.some((key) => !credentials[key])) {
      throw new Error('Provide all required credentials of the bank together.');
    }
    return {
      name: text(values['name']),
      ...(editing ? {} : { provider: text(values['provider']) }),
      environment: text(values['environment']),
      purpose: text(values['purpose']),
      ...(declares(values, 'accountNumber')
        ? { accountNumber: text(values['accountNumber']).replace(/\D/g, '') }
        : {}),
      ...(declares(values, 'receiveMethods')
        ? { receiveMethods: text(values['receiveMethods']) }
        : {}),
      ...(declares(values, 'autoCancelDays')
        ? { autoCancelDays: Number(values['autoCancelDays']) }
        : {}),
      status: Number(values['status']) === 1 ? 1 : 0,
      ...(replacing ? { credentials } : {}),
    };
  },
});
