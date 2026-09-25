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
/** Fallback until the catalog loads; the API remains the source of truth. */
export const defaultBankOptions: readonly ConfigurableCrudOption[] = [
  { value: INTER, label: 'Inter Empresas' },
];

export const PEM_FIELDS = ['certPem', 'keyPem', 'webhookCaPem'] as const;
const SECRET_FIELDS = ['clientId', 'clientSecret', ...PEM_FIELDS] as const;

const isInter = ({ values }: { values: ConfigurableCrudRecord }) =>
  String(values['provider'] ?? '') === INTER;
const hideUnlessInter = (context: { values: ConfigurableCrudRecord }) => !isInter(context);
const requiredOnCreate = ({
  editing,
  values,
}: {
  editing: boolean;
  values: ConfigurableCrudRecord;
}) => !editing && isInter({ values });
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
    hiddenWhen: hideUnlessInter,
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
    required: true,
    autocomplete: 'off',
    hint: 'Inter checking account number (x-conta-corrente).',
    hiddenWhen: hideUnlessInter,
  },
  {
    key: 'receiveMethods',
    source: 'PbcReceiveMethods',
    label: 'Receive methods',
    type: 'select',
    tab: 'financial',
    span: 1,
    required: true,
    options: receiveMethodOptions,
    hiddenWhen: hideUnlessInter,
  },
  {
    key: 'autoCancelDays',
    source: 'PbcAutoCancelDays',
    label: 'Days to cancel after due date',
    type: 'number',
    tab: 'financial',
    span: 1,
    required: true,
    hint: 'Between 0 and 60 days. After this period the bank cancels the unpaid charge.',
    hiddenWhen: hideUnlessInter,
  },
  {
    key: 'clientId',
    label: 'Client ID',
    tab: 'authentication',
    span: 2,
    autocomplete: 'off',
    translateLabel: false,
    fromRecord: () => '',
    requiredWhen: requiredOnCreate,
    hintWhen: keepSecretHint,
    hiddenWhen: hideUnlessInter,
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
    requiredWhen: requiredOnCreate,
    hiddenWhen: hideUnlessInter,
  },
  {
    key: 'certPem',
    label: 'Certificate (.crt)',
    type: 'file',
    accept: '.crt,.pem',
    tab: 'authentication',
    span: 2,
    fromRecord: () => '',
    requiredWhen: requiredOnCreate,
    hiddenWhen: hideUnlessInter,
  },
  {
    key: 'keyPem',
    label: 'Private key (.key)',
    type: 'file',
    accept: '.key,.pem',
    tab: 'authentication',
    span: 2,
    fromRecord: () => '',
    requiredWhen: requiredOnCreate,
    hiddenWhen: hideUnlessInter,
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
    hiddenWhen: hideUnlessInter,
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
    const credentials: Record<string, string> = {};
    for (const key of SECRET_FIELDS) {
      const value = text(values[key]);
      if (value) credentials[key] = value;
    }
    const replacing = Object.keys(credentials).length > 0;
    if (
      replacing &&
      ['clientId', 'clientSecret', 'certPem', 'keyPem'].some((key) => !credentials[key])
    ) {
      throw new Error('Provide Client ID, Client Secret, certificate and private key together.');
    }
    return {
      name: text(values['name']),
      ...(editing ? {} : { provider: text(values['provider']) }),
      environment: text(values['environment']),
      accountNumber: text(values['accountNumber']).replace(/\D/g, ''),
      purpose: text(values['purpose']),
      receiveMethods: text(values['receiveMethods']),
      autoCancelDays: Number(values['autoCancelDays']),
      status: Number(values['status']) === 1 ? 1 : 0,
      ...(replacing ? { credentials } : {}),
    };
  },
});
