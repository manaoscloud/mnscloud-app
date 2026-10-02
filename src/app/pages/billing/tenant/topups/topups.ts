import { Component, inject, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudSaveContext,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { quickCreateFor } from '../../../../shared/crud/configurable-crud/quick-create';
import { BILLING_STATUS_OPTIONS } from '../../shared/billing-crud';
import { BillingPaymentIntent, BillingService } from '../../shared/billing.service';

/** Brazilian states for the bank payer address (UF codes are not translated). */
const STATE_OPTIONS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
].map((value) => ({ value, label: value }));

const isPending = (row: ConfigurableCrudRecord) => String(row['BpiStatus'] ?? '') === 'PENDING';

type FieldValues = { values: ConfigurableCrudRecord };
const isCompany = ({ values }: FieldValues) => values['payerType'] === 'JURIDICA';
const isIndividual = (context: FieldValues) => !isCompany(context);
/** Company data comes from its registration; the individual's stored CPF is changed only in the profile. */
const lockedFor =
  (flag: string) =>
  ({ values }: FieldValues) =>
    values['payerType'] === 'JURIDICA' || Boolean(values[flag]);

/** Tenant companies that may pay; Billing read, available without the ERP module. */
type PayerCompany = {
  ErpCompanyComUUID: string;
  ComName: string;
  ComLegalName: string | null;
  ComDocument: string | null;
  ComEmail: string | null;
  ComAddressZip: string | null;
  ComAddressStreet: string | null;
  ComAddressNumber: string | null;
  ComAddressComplement: string | null;
  ComAddressDistrict: string | null;
  ComAddressCity: string | null;
  ComAddressState: string | null;
};

/** Billing data of the signed-in user returned by GET /user/profile. */
type UserBillingProfile = {
  FirstName?: string | null;
  LastName?: string | null;
  Email?: string | null;
  Document?: string | null;
  AddressZip?: string | null;
  AddressStreet?: string | null;
  AddressNumber?: string | null;
  AddressComplement?: string | null;
  AddressDistrict?: string | null;
  AddressCity?: string | null;
  AddressState?: string | null;
};

const PAYER_FIELDS = [
  'payerName',
  'payerDocument',
  'payerEmail',
  'payerZip',
  'payerAddress',
  'payerNumber',
  'payerComplement',
  'payerDistrict',
  'payerCity',
  'payerState',
] as const;

/** Set by the page: the company quick-create opens the ERP form, so it needs the ERP module. */
const companyQuickCreateEnabled = signal(false);

/** Payer-facing data returned by the bank on sync; absent until the charge is registered. */
type TopupPaymentInstructions = {
  dueDate: string | null;
  amount: number | null;
  digitableLine: string | null;
  barcode: string | null;
  pixCopyPaste: string | null;
};

type TopupSyncResult = BillingPaymentIntent & {
  syncStatus?: string | null;
  paymentInstructions?: TopupPaymentInstructions | null;
};

const TOPUPS_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'billing/topups',
  uuidField: 'BpiUUID',
  pageTitle: 'Top-ups',
  pageDescription: 'Create payment requests to add credit to your tenant wallet.',
  createTitle: 'New top-up',
  editTitle: 'Top-up',
  dialogDescription: 'Enter the payment data required by the configured provider.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No top-ups found.',
  deleteTitle: 'Delete top-up',
  deleteMessage: 'Delete this top-up?',
  deleteSelectedTitle: 'Delete selected top-ups',
  deleteSelectedMessage: 'Delete {count} selected top-ups?',
  savedMessage: 'Top-up request created. Credit will be applied after payment confirmation.',
  deletedMessage: 'Top-up deleted successfully.',
  deleteFailedMessage: 'Failed to delete top-up.',
  canCreate: true,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: true,
  rowActions: [
    {
      key: 'open-checkout',
      label: 'Open payment',
      icon: 'open_in_new',
      visible: (row) => Boolean(row['BpiCheckoutUrl']),
    },
    { key: 'copy-pix', label: 'Copy Pix code', icon: 'qr_code_2', visible: isPending },
    { key: 'copy-boleto', label: 'Copy boleto line', icon: 'receipt_long', visible: isPending },
    { key: 'sync', label: 'Check payment', icon: 'sync', visible: isPending },
  ],
  ...BILLING_STATUS_OPTIONS,
  initialValues: {
    payerType: 'FISICA',
    ErpCompanyComUUID: '',
    amount: '',
    reference: '',
    payerName: '',
    payerDocument: '',
    payerEmail: '',
    payerAddress: '',
    payerNumber: '',
    payerComplement: '',
    payerDistrict: '',
    payerCity: '',
    payerState: '',
    payerZip: '',
    dueDate: '',
    idempotencyKey: '',
  },
  columns: [
    { id: 'id', label: 'Reference', kind: 'identity', field: 'BpiID', uuidField: 'BpiUUID' },
    { id: 'amount', label: 'Amount', field: 'BpiAmount' },
    { id: 'currency', label: 'Currency', field: 'BpiCurrency' },
    {
      id: 'provider',
      label: 'Bank',
      field: 'PbcProvider',
      options: [{ value: 'inter_business', label: 'Inter Empresas' }],
      translateValue: false,
    },
    { id: 'created', label: 'Created at', kind: 'datetime', field: 'BpiDateCreated' },
    { id: 'expires', label: 'Expires at', kind: 'datetime', field: 'BpiExpiresAt' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BpiStatus' },
  ],
  fields: [
    {
      key: 'payerType',
      label: 'Payer type',
      type: 'select',
      span: 1,
      lineFillAfter: 3,
      required: true,
      options: [
        { value: 'FISICA', label: 'Individual' },
        { value: 'JURIDICA', label: 'Company' },
      ],
    },
    { key: 'amount', label: 'Amount', type: 'currency', span: 1, required: true },
    { key: 'reference', label: 'Reference', type: 'text', span: 2 },
    { key: 'dueDate', label: 'Due date', type: 'date', span: 1 },
    {
      key: 'ErpCompanyComUUID',
      source: 'ErpCompanyComUUID',
      label: 'Company',
      type: 'search-select',
      span: 2,
      remoteLookup: {
        endpoint: 'billing/payer-companies',
        uuidField: 'ErpCompanyComUUID',
        labelField: 'ComName',
      },
      quickCreate: quickCreateFor('ErpCompanyComUUID', {
        enabled: () => companyQuickCreateEnabled(),
      }),
      hiddenWhen: isIndividual,
      requiredWhen: isCompany,
    },
    {
      key: 'payerName',
      label: 'Payer name',
      type: 'text',
      span: 2,
      hiddenWhen: isCompany,
      requiredWhen: isIndividual,
      disabledWhen: lockedFor('payerNameLocked'),
    },
    {
      key: 'payerDocument',
      label: 'Payer document',
      labelWhen: (context) => (isCompany(context) ? 'CNPJ' : 'CPF'),
      translateLabel: false,
      type: 'text',
      span: 1,
      required: true,
      disabledWhen: lockedFor('payerDocumentLocked'),
      helpWhen: (context) =>
        isIndividual(context) && context.values['payerDocumentLocked']
          ? 'To change the CPF, edit your user profile.'
          : '',
    },
    {
      key: 'payerEmail',
      label: 'E-mail',
      type: 'email',
      span: 1,
      requiredWhen: isIndividual,
      disabledWhen: lockedFor('payerEmailLocked'),
    },
    {
      key: 'payerZip',
      label: 'ZIP code',
      type: 'text',
      span: 1,
      breakBefore: true,
      required: true,
      disabledWhen: isCompany,
      postalLookup: {
        streetKey: 'payerAddress',
        districtKey: 'payerDistrict',
        cityKey: 'payerCity',
        stateKey: 'payerState',
        numberKey: 'payerNumber',
      },
    },
    {
      key: 'payerAddress',
      label: 'Address',
      type: 'text',
      span: 2,
      required: true,
      disabledWhen: isCompany,
    },
    { key: 'payerNumber', label: 'Number', type: 'text', span: 1, disabledWhen: isCompany },
    {
      key: 'payerComplement',
      label: 'Complement',
      type: 'text',
      span: 1,
      disabledWhen: isCompany,
    },
    { key: 'payerDistrict', label: 'Neighborhood', type: 'text', span: 1, disabledWhen: isCompany },
    {
      key: 'payerCity',
      label: 'City',
      type: 'text',
      span: 1,
      required: true,
      disabledWhen: isCompany,
    },
    {
      key: 'payerState',
      label: 'State',
      type: 'select',
      span: 1,
      required: true,
      options: STATE_OPTIONS,
      translateOptions: false,
      disabledWhen: isCompany,
    },
    { key: 'idempotencyKey', label: 'Idempotency key', type: 'text', hidden: true },
  ],
};

@Component({
  selector: 'app-billing-tenant-topups',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class BillingTenantTopupsPage extends ConfigurableCrudPageBase<
  BillingPaymentIntent & ConfigurableCrudRecord
> {
  private readonly billing = inject(BillingService);
  /** Billing data of the signed-in user, loaded when a top-up form opens. */
  private readonly profile = signal<UserBillingProfile | null>(null);

  constructor() {
    super(TOPUPS_CONFIG);
    void this.loadCompanyQuickCreate();
  }

  override startCreate(): void {
    super.startCreate();
    this.patchFormValues({ idempotencyKey: crypto.randomUUID() });
    void this.applyProfile();
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key === 'payerType') {
      if (value === 'JURIDICA') {
        this.patchFormValues({ ErpCompanyComUUID: '', ...this.emptyPayer() });
      } else {
        this.patchFormValues({ ErpCompanyComUUID: '' });
        void this.applyProfile();
      }
      return;
    }
    if (key === 'ErpCompanyComUUID') void this.applyCompany(String(value ?? ''));
  }

  /** The API builds the bank payer: the user profile (FISICA) or the tenant company (JURIDICA). */
  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const request: ConfigurableCrudRecord = {
      amount: payload['amount'],
      reference: payload['reference'],
      dueDate: payload['dueDate'],
      idempotencyKey: payload['idempotencyKey'],
      payerType: payload['payerType'],
    };
    if (payload['payerType'] === 'JURIDICA') {
      return { ...request, ErpCompanyComUUID: payload['ErpCompanyComUUID'] };
    }
    return {
      ...request,
      payer: {
        nome: payload['payerName'],
        cpfCnpj: String(payload['payerDocument'] ?? '').replace(/\D/g, ''),
        email: payload['payerEmail'],
        endereco: payload['payerAddress'],
        numero: payload['payerNumber'],
        complemento: payload['payerComplement'],
        bairro: payload['payerDistrict'],
        cidade: payload['payerCity'],
        uf: payload['payerState'],
        cep: String(payload['payerZip'] ?? '').replace(/\D/g, ''),
      },
    };
  }

  private emptyPayer(): ConfigurableCrudRecord {
    return {
      ...Object.fromEntries(PAYER_FIELDS.map((key) => [key, ''])),
      payerNameLocked: false,
      payerDocumentLocked: false,
      payerEmailLocked: false,
    };
  }

  /** Prefills an individual payer from the user profile; what is missing is typed and saved. */
  private async applyProfile(): Promise<void> {
    let profile = this.profile();
    if (!profile) {
      try {
        const response = await this.api.get<{ data?: UserBillingProfile }>('user/profile');
        profile = response.data ?? {};
        this.profile.set(profile);
      } catch {
        profile = {};
      }
    }
    if (this.formValues()['payerType'] === 'JURIDICA') return;
    const name = [profile.FirstName, profile.LastName].filter(Boolean).join(' ');
    this.patchFormValues({
      payerName: name,
      payerDocument: profile.Document ?? '',
      payerEmail: profile.Email ?? '',
      payerZip: profile.AddressZip ?? '',
      payerAddress: profile.AddressStreet ?? '',
      payerNumber: profile.AddressNumber ?? '',
      payerComplement: profile.AddressComplement ?? '',
      payerDistrict: profile.AddressDistrict ?? '',
      payerCity: profile.AddressCity ?? '',
      payerState: profile.AddressState ?? '',
      payerNameLocked: Boolean(name),
      payerDocumentLocked: Boolean(profile.Document),
      payerEmailLocked: Boolean(profile.Email),
    });
  }

  /** Shows the selected company's registration data (read-only; fixed in the company form). */
  private async applyCompany(companyUUID: string): Promise<void> {
    if (!companyUUID) {
      this.patchFormValues(this.emptyPayer());
      return;
    }
    try {
      const response = await this.api.get<{ data?: { items?: PayerCompany[] } }>(
        `billing/payer-companies?ErpCompanyComUUID=${encodeURIComponent(companyUUID)}&limit=1`,
      );
      const company = response.data?.items?.[0];
      if (!company || this.formValues()['ErpCompanyComUUID'] !== companyUUID) return;
      this.patchFormValues({
        payerName: company.ComLegalName ?? company.ComName,
        payerDocument: company.ComDocument ?? '',
        payerEmail: company.ComEmail ?? '',
        payerZip: company.ComAddressZip ?? '',
        payerAddress: company.ComAddressStreet ?? '',
        payerNumber: company.ComAddressNumber ?? '',
        payerComplement: company.ComAddressComplement ?? '',
        payerDistrict: company.ComAddressDistrict ?? '',
        payerCity: company.ComAddressCity ?? '',
        payerState: company.ComAddressState ?? '',
      });
      const missing = [
        company.ComDocument,
        company.ComAddressZip,
        company.ComAddressStreet,
        company.ComAddressCity,
        company.ComAddressState,
      ].some((item) => !item);
      if (missing) {
        this.snack.warning(
          this.t(
            'This company is missing CNPJ or address data. Complete the company registration.',
          ),
        );
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error));
    }
  }

  /** Creating a company opens the ERP company form, which requires the ERP module. */
  private async loadCompanyQuickCreate(): Promise<void> {
    try {
      const grants = await this.billing.listEntitlementGrants();
      companyQuickCreateEnabled.set(
        grants.some((grant) => grant.entitlementCode?.toLowerCase().startsWith('module.erp')),
      );
    } catch {
      companyQuickCreateEnabled.set(false);
    }
  }

  protected override afterSave(
    context: ConfigurableCrudSaveContext<BillingPaymentIntent & ConfigurableCrudRecord>,
  ): void {
    const item = (context.response as { data?: { item?: BillingPaymentIntent } })?.data?.item;
    if (!item || context.mode !== 'create') return;
    this.snack.success(this.t('Payment request is ready. Use the action in the list to continue.'));
  }

  override async handleRowAction(
    action: { key: string },
    row: BillingPaymentIntent & ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key === 'open-checkout') {
      if (!row.BpiCheckoutUrl) return;
      const popup = window.open(row.BpiCheckoutUrl, '_blank', 'noopener,noreferrer');
      if (popup) popup.opener = null;
      return;
    }
    if (!['sync', 'copy-pix', 'copy-boleto'].includes(action.key)) return;
    const result = await this.syncWithBank(row);
    if (!result) return;
    if (String(result.BpiStatus ?? '') === 'PAID') {
      this.snack.success(this.t('Payment confirmed. Credit added to the wallet.'));
      this.refreshList();
      return;
    }
    const instructions = result.paymentInstructions ?? null;
    if (action.key === 'sync') {
      this.snack.success(
        this.t(
          instructions ? 'Payment not confirmed yet.' : 'The bank is still issuing the charge.',
        ),
      );
      return;
    }
    const value =
      action.key === 'copy-pix' ? instructions?.pixCopyPaste : instructions?.digitableLine;
    if (!value) {
      this.snack.error(this.t('The bank is still issuing the charge.'));
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      this.snack.success(this.t('Data copied.'));
    } catch {
      this.snack.error(this.t('Failed to copy data.'));
    }
  }

  /** Re-reads the charge from the bank; the wallet is credited only after a bank-confirmed receipt. */
  private async syncWithBank(row: BillingPaymentIntent): Promise<TopupSyncResult | null> {
    try {
      const response = await this.api.post<{ data?: { item?: TopupSyncResult } }>(
        `billing/topups/${row.BpiUUID}/sync`,
        {},
      );
      return response.data?.item ?? null;
    } catch (error) {
      this.snack.error(this.errorMessage(error));
      return null;
    }
  }
}
