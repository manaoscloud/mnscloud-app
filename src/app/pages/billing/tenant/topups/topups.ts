import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudSaveContext,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BILLING_STATUS_OPTIONS } from '../../shared/billing-crud';
import { BillingPaymentIntent } from '../../shared/billing.service';

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
    amount: '',
    reference: '',
    payerName: '',
    payerDocument: '',
    payerEmail: '',
    payerType: 'FISICA',
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
    { key: 'amount', label: 'Amount', type: 'currency', span: 1, required: true },
    { key: 'reference', label: 'Reference', type: 'text', span: 2 },
    { key: 'dueDate', label: 'Due date', type: 'date', span: 1 },
    {
      key: 'payerType',
      label: 'Payer type',
      type: 'select',
      span: 1,
      required: true,
      options: [
        { value: 'FISICA', label: 'Individual' },
        { value: 'JURIDICA', label: 'Company' },
      ],
    },
    { key: 'payerName', label: 'Payer name', type: 'text', span: 2, required: true },
    { key: 'payerDocument', label: 'Payer document', type: 'text', span: 1, required: true },
    { key: 'payerEmail', label: 'E-mail', type: 'email', span: 1, required: true },
    { key: 'payerZip', label: 'ZIP code', type: 'text', span: 1, required: true },
    { key: 'payerAddress', label: 'Address', type: 'text', span: 2, required: true },
    { key: 'payerNumber', label: 'Number', type: 'text', span: 1 },
    { key: 'payerComplement', label: 'Complement', type: 'text', span: 1 },
    { key: 'payerDistrict', label: 'Neighborhood', type: 'text', span: 1 },
    { key: 'payerCity', label: 'City', type: 'text', span: 1, required: true },
    {
      key: 'payerState',
      label: 'State',
      type: 'select',
      span: 1,
      required: true,
      options: STATE_OPTIONS,
      translateOptions: false,
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
  constructor() {
    super(TOPUPS_CONFIG);
  }

  override startCreate(): void {
    super.startCreate();
    this.patchFormValues({ idempotencyKey: crypto.randomUUID() });
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const {
      payerName,
      payerDocument,
      payerEmail,
      payerType,
      payerAddress,
      payerNumber,
      payerComplement,
      payerDistrict,
      payerCity,
      payerState,
      payerZip,
      ...request
    } = payload;
    return {
      ...request,
      payer: {
        nome: payerName,
        cpfCnpj: String(payerDocument ?? '').replace(/\D/g, ''),
        email: payerEmail,
        tipoPessoa: payerType,
        endereco: payerAddress,
        numero: payerNumber,
        complemento: payerComplement,
        bairro: payerDistrict,
        cidade: payerCity,
        uf: payerState,
        cep: String(payerZip ?? '').replace(/\D/g, ''),
      },
    };
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
