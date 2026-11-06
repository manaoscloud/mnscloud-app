import {
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

/**
 * Tenant payment gateways (Financial): the tenant's own accounts used to charge its customers.
 * Independent from MNSCloud Pay bank partners (System > Pay). The gateway list comes from the
 * tenant catalog API; each gateway shows only the fields its integration needs.
 */
export const MNSCLOUD_PAY = 'mnscloud_pay';
export const INTER_OWN_ACCOUNT = 'inter_business';
export const ASAAS_OWN_ACCOUNT = 'asaas';

const statusOptions: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];
const yesNoOptions: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
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
const companyTypeOptions: readonly ConfigurableCrudOption[] = [
  { value: 'LIMITED', label: 'Limited Company (LTDA)' },
  { value: 'MEI', label: 'Individual Microentrepreneur (MEI)' },
  { value: 'INDIVIDUAL', label: 'Sole Proprietorship (EI)' },
  { value: 'ASSOCIATION', label: 'Association / Non-profit' },
];
const payoutModeOptions: readonly ConfigurableCrudOption[] = [
  { value: 'DAILY_BATCH', label: 'Daily batch (recommended)' },
  { value: 'IMMEDIATE', label: 'Immediate on settlement' },
  { value: 'MANUAL', label: 'Manual withdrawal' },
];
const pixKeyTypeOptions: readonly ConfigurableCrudOption[] = [
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'CPF', label: 'CPF' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'EVP', label: 'Random key (EVP)' },
];
/** Fallback until the catalog loads; the API remains the source of truth. Only MNSCloud Pay is offered. */
export const defaultGatewayOptions: readonly ConfigurableCrudOption[] = [
  { value: MNSCLOUD_PAY, label: 'MNSCloud Pay' },
];

export const GATEWAY_PEM_FIELDS = ['certPem', 'keyPem'] as const;
const CREDENTIAL_FIELDS = ['clientId', 'clientSecret', ...GATEWAY_PEM_FIELDS] as const;

const isInter = ({ values }: { values: ConfigurableCrudRecord }) =>
  String(values['provider'] ?? '') === INTER_OWN_ACCOUNT;
const isAsaas = ({ values }: { values: ConfigurableCrudRecord }) =>
  String(values['provider'] ?? '') === ASAAS_OWN_ACCOUNT;
const isMnscloudPay = ({ values }: { values: ConfigurableCrudRecord }) =>
  String(values['provider'] ?? '') === MNSCLOUD_PAY;

const hideUnlessInter = (context: { values: ConfigurableCrudRecord }) => !isInter(context);
const hideUnlessAsaas = (context: { values: ConfigurableCrudRecord }) => !isAsaas(context);
const hideUnlessSupportedGateway = (context: { values: ConfigurableCrudRecord }) =>
  !isMnscloudPay(context) && !isInter(context) && !isAsaas(context);

const requiredOnCreate = ({
  editing,
  values,
}: {
  editing: boolean;
  values: ConfigurableCrudRecord;
}) => !editing && isInter({ values });

const requiredAsaasOnCreate = ({
  editing,
  values,
}: {
  editing: boolean;
  values: ConfigurableCrudRecord;
}) => !editing && isAsaas({ values });

const keepSecretHelp = ({ editing }: { editing: boolean }) =>
  editing ? 'Leave empty to keep the stored credentials. Replacing requires all fields.' : '';

const fields: ConfigurableCrudField[] = [
  {
    key: 'status',
    source: 'FgaIsActive',
    label: 'Status',
    type: 'status',
    span: 1,
    options: statusOptions,
  },
  {
    key: 'provider',
    source: 'FgaProvider',
    label: 'Gateway',
    type: 'select',
    span: 1,
    required: true,
    disabledWhen: ({ editing }) => editing,
    translateOptions: false,
  },
  { key: 'name', source: 'FgaName', label: 'Name', required: true, span: 1 },
  {
    key: 'environment',
    source: 'FgaEnvironment',
    label: 'Environment',
    type: 'select',
    span: 1,
    required: true,
    options: environmentOptions,
    hiddenWhen: hideUnlessSupportedGateway,
  },
  {
    key: 'isDefault',
    source: 'FgaIsDefault',
    label: 'Default for boletos',
    type: 'select',
    span: 1,
    options: yesNoOptions,
  },
  {
    key: 'accountNumber',
    source: 'FgaAccountNumber',
    label: 'Checking account',
    tab: 'financial',
    span: 1,
    required: true,
    autocomplete: 'off',
    help: 'Inter checking account number (x-conta-corrente).',
    hiddenWhen: hideUnlessInter,
  },
  {
    key: 'receiveMethods',
    source: 'FgaReceiveMethods',
    label: 'Receive methods',
    type: 'select',
    tab: 'financial',
    span: 1,
    required: true,
    options: receiveMethodOptions,
    hiddenWhen: hideUnlessSupportedGateway,
  },
  {
    key: 'autoCancelDays',
    source: 'FgaAutoCancelDays',
    label: 'Days to cancel after due date',
    type: 'number',
    tab: 'financial',
    span: 1,
    required: true,
    help: 'Between 0 and 60 days. After this period the bank cancels the unpaid charge.',
    hiddenWhen: hideUnlessSupportedGateway,
  },
  {
    key: 'apiKey',
    label: 'API Key',
    type: 'password',
    tab: 'authentication',
    autocomplete: 'new-password',
    translateLabel: false,
    fromRecord: () => '',
    requiredWhen: requiredAsaasOnCreate,
    helpWhen: keepSecretHelp,
    hiddenWhen: hideUnlessAsaas,
  },
  {
    key: 'clientId',
    label: 'Client ID',
    tab: 'authentication',
    autocomplete: 'off',
    translateLabel: false,
    fromRecord: () => '',
    requiredWhen: requiredOnCreate,
    helpWhen: keepSecretHelp,
    hiddenWhen: hideUnlessInter,
  },
  {
    key: 'clientSecret',
    label: 'Client Secret',
    type: 'password',
    tab: 'authentication',
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
    key: 'companyType',
    label: 'Company type',
    type: 'select',
    tab: 'financial',
    span: 1,
    options: companyTypeOptions,
    hiddenWhen: (context) => !isMnscloudPay(context),
  },
  {
    key: 'incomeValue',
    label: 'Estimated monthly revenue',
    type: 'number',
    tab: 'financial',
    span: 1,
    hiddenWhen: (context) => !isMnscloudPay(context),
  },
  {
    key: 'mobilePhone',
    label: 'Commercial mobile phone',
    tab: 'financial',
    span: 1,
    hiddenWhen: (context) => !isMnscloudPay(context),
  },
  {
    key: 'payoutMode',
    label: 'Payout mode',
    type: 'select',
    tab: 'financial',
    span: 1,
    options: payoutModeOptions,
    hiddenWhen: (context) => !isMnscloudPay(context),
  },
  {
    key: 'payoutMinAmount',
    label: 'Minimum payout amount',
    type: 'number',
    tab: 'financial',
    span: 1,
    help: 'Minimum R$ 50.00 for automatic payouts.',
    hiddenWhen: (context) => !isMnscloudPay(context),
  },
  {
    key: 'payoutPixKeyType',
    label: 'Payout Pix key type',
    type: 'select',
    tab: 'financial',
    span: 1,
    options: pixKeyTypeOptions,
    hiddenWhen: (context) => !isMnscloudPay(context),
  },
  {
    key: 'payoutPixKey',
    label: 'Payout Pix key',
    tab: 'financial',
    span: 1,
    help: 'Same ownership: must match the CPF or CNPJ of the tenant tax identity.',
    hiddenWhen: (context) => !isMnscloudPay(context),
  },
];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

export const paymentGatewayConfig = defineCrud({
  serverSidePagination: true,
  endpoint: 'financial/gateway-accounts',
  uuidField: 'FgaUUID',
  pageTitle: 'Payment Gateways',
  pageDescription: 'Your own gateway accounts used to issue boletos and Pix to your customers.',
  createTitle: 'New payment gateway',
  editTitle: 'Edit payment gateway',
  dialogDescription: 'Select the gateway; only the fields its integration requires are shown.',
  searchPlaceholder: 'ID, name, gateway or account',
  emptyLabel: 'No payment gateways found.',
  savedMessage: 'Payment gateway saved.',
  canDelete: true,
  bulkDelete: true,
  statusOptions,
  tabLabels: {
    record: 'Identification',
    financial: 'Account and charges',
    authentication: 'Credentials',
  },
  initialValues: {
    status: 1,
    provider: MNSCLOUD_PAY,
    name: 'MNSCloud Pay',
    environment: 'production',
    isDefault: 1,
    accountNumber: '',
    receiveMethods: 'BOLETO,PIX',
    autoCancelDays: 30,
    clientId: '',
    clientSecret: '',
    certPem: '',
    keyPem: '',
    companyType: 'LIMITED',
    incomeValue: 10000,
    mobilePhone: '',
    payoutMode: 'DAILY_BATCH',
    payoutMinAmount: 50,
    payoutPixKeyType: 'CNPJ',
    payoutPixKey: '',
  },
  fields,
  columns: [
    { id: 'id', label: 'ID', field: 'FgaID', kind: 'text' },
    { id: 'name', label: 'Name', field: 'FgaName', kind: 'identity' },
    {
      id: 'provider',
      label: 'Gateway',
      field: 'FgaProvider',
      options: defaultGatewayOptions,
      translateValue: false,
    },
    {
      id: 'environment',
      label: 'Environment',
      field: 'FgaEnvironment',
      options: environmentOptions,
    },
    { id: 'account', label: 'Checking account', field: 'FgaAccountNumber', kind: 'text' },
    {
      id: 'certificate',
      label: 'Certificate expires',
      field: 'FgaCertificateExpiresAt',
      kind: 'date',
    },
    { id: 'default', label: 'Default for boletos', field: 'FgaIsDefault', kind: 'boolean' },
    { id: 'status', label: 'Status', field: 'FgaIsActive', kind: 'status' },
  ],
  rowActions: [{ key: 'validate', label: 'Validate connection', icon: 'verified' }],
  payload: (values, editing) => {
    const provider = text(values['provider']);
    if (provider === MNSCLOUD_PAY) {
      return {
        name: text(values['name']),
        ...(editing ? {} : { provider: MNSCLOUD_PAY }),
        environment: text(values['environment']) || 'production',
        receiveMethods: text(values['receiveMethods']) || 'BOLETO,PIX',
        autoCancelDays: Number(values['autoCancelDays']) || 30,
        isDefault: Number(values['isDefault']) === 1 ? 1 : 0,
        isActive: Number(values['status']) === 1 ? 1 : 0,
      };
    }
    if (provider === ASAAS_OWN_ACCOUNT) {
      const apiKey = text(values['apiKey']);
      const credentials: Record<string, string> = {};
      if (apiKey) credentials['apiKey'] = apiKey;
      if (!editing && !apiKey) {
        throw new Error('Provide the Asaas API Key.');
      }
      return {
        name: text(values['name']),
        ...(editing ? {} : { provider: ASAAS_OWN_ACCOUNT }),
        environment: text(values['environment']),
        receiveMethods: text(values['receiveMethods']) || 'BOLETO,PIX',
        autoCancelDays: Number(values['autoCancelDays']) || 30,
        isDefault: Number(values['isDefault']) === 1 ? 1 : 0,
        isActive: Number(values['status']) === 1 ? 1 : 0,
        ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
      };
    }

    const credentials: Record<string, string> = {};
    for (const key of CREDENTIAL_FIELDS) {
      const value = text(values[key]);
      if (value) credentials[key] = value;
    }
    const replacing = Object.keys(credentials).length > 0;
    if (replacing && CREDENTIAL_FIELDS.some((key) => !credentials[key])) {
      throw new Error('Provide Client ID, Client Secret, certificate and private key together.');
    }
    return {
      name: text(values['name']),
      ...(editing ? {} : { provider: text(values['provider']) }),
      environment: text(values['environment']),
      accountNumber: text(values['accountNumber']).replace(/\D/g, ''),
      receiveMethods: text(values['receiveMethods']),
      autoCancelDays: Number(values['autoCancelDays']),
      isDefault: Number(values['isDefault']) === 1 ? 1 : 0,
      isActive: Number(values['status']) === 1 ? 1 : 0,
      ...(replacing ? { credentials } : {}),
    };
  },
});
