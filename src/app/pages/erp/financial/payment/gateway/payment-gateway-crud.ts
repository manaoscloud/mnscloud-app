import {
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../../shared/crud/configurable-crud/define-crud';

/**
 * Tenant payment gateways (ERP): the tenant's own accounts used to charge its customers.
 * Independent from MNSCloud Pay bank partners (System > Pay). The gateway list comes from the
 * tenant catalog API; each gateway shows only the fields its integration needs.
 */
export const INTER_OWN_ACCOUNT = 'inter_business';

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
/** Fallback until the catalog loads; the API remains the source of truth. */
export const defaultGatewayOptions: readonly ConfigurableCrudOption[] = [
  { value: INTER_OWN_ACCOUNT, label: 'Inter Empresas (conta própria)' },
];

export const GATEWAY_PEM_FIELDS = ['certPem', 'keyPem'] as const;
const CREDENTIAL_FIELDS = ['clientId', 'clientSecret', ...GATEWAY_PEM_FIELDS] as const;

const isInter = ({ values }: { values: ConfigurableCrudRecord }) =>
  String(values['provider'] ?? '') === INTER_OWN_ACCOUNT;
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
    source: 'EfgIsActive',
    label: 'Status',
    type: 'status',
    span: 1,
    options: statusOptions,
  },
  {
    key: 'provider',
    source: 'EfgProvider',
    label: 'Gateway',
    type: 'select',
    span: 1,
    required: true,
    disabledWhen: ({ editing }) => editing,
    translateOptions: false,
  },
  { key: 'name', source: 'EfgName', label: 'Name', required: true, span: 1 },
  {
    key: 'environment',
    source: 'EfgEnvironment',
    label: 'Environment',
    type: 'select',
    span: 1,
    required: true,
    options: environmentOptions,
    hiddenWhen: hideUnlessInter,
  },
  {
    key: 'isDefault',
    source: 'EfgIsDefault',
    label: 'Default for boletos',
    type: 'select',
    span: 1,
    options: yesNoOptions,
  },
  {
    key: 'accountNumber',
    source: 'EfgAccountNumber',
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
    source: 'EfgReceiveMethods',
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
    source: 'EfgAutoCancelDays',
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
];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

export const paymentGatewayConfig = defineCrud({
  serverSidePagination: true,
  endpoint: 'erp/financial/payment/gateways',
  uuidField: 'EfgUUID',
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
    provider: INTER_OWN_ACCOUNT,
    name: '',
    environment: 'production',
    isDefault: 0,
    accountNumber: '',
    receiveMethods: 'BOLETO,PIX',
    autoCancelDays: 30,
    clientId: '',
    clientSecret: '',
    certPem: '',
    keyPem: '',
  },
  fields,
  columns: [
    { id: 'id', label: 'ID', field: 'EfgID', kind: 'text' },
    { id: 'name', label: 'Name', field: 'EfgName', kind: 'identity' },
    {
      id: 'provider',
      label: 'Gateway',
      field: 'EfgProvider',
      options: defaultGatewayOptions,
      translateValue: false,
    },
    {
      id: 'environment',
      label: 'Environment',
      field: 'EfgEnvironment',
      options: environmentOptions,
    },
    { id: 'account', label: 'Checking account', field: 'EfgAccountNumber', kind: 'text' },
    {
      id: 'certificate',
      label: 'Certificate expires',
      field: 'EfgCertificateExpiresAt',
      kind: 'date',
    },
    { id: 'default', label: 'Default for boletos', field: 'EfgIsDefault', kind: 'boolean' },
    { id: 'status', label: 'Status', field: 'EfgIsActive', kind: 'status' },
  ],
  rowActions: [{ key: 'validate', label: 'Validate connection', icon: 'verified' }],
  payload: (values, editing) => {
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
