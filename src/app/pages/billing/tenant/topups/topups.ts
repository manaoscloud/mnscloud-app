import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudSaveContext,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingPaymentIntent } from '../../shared/billing.service';

const TOPUP_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELED', label: 'Canceled' },
];

const isPending = (row: ConfigurableCrudRecord) => String(row['BpiStatus'] ?? '') === 'PENDING';
const isCard = (row: ConfigurableCrudRecord) => row['BpiPaymentMethod'] === 'CREDIT_CARD';
const isPendingBoleto = (row: ConfigurableCrudRecord) => isPending(row) && !isCard(row);
const isPaid = (row: ConfigurableCrudRecord) =>
  String(row['BpiStatus'] ?? '').toUpperCase() === 'PAID';

/** Payment methods served by active bank connections, with the card fee passed on to the tenant. */
type TopupMethod = {
  method: 'PIX_BOLETO' | 'CREDIT_CARD';
  provider: string;
  feePercent: number;
  feeFixed: number;
};
const METHOD_LABELS: Record<string, string> = {
  PIX_BOLETO: 'Pix or boleto',
  CREDIT_CARD: 'Credit card',
};
const topupMethods = signal<TopupMethod[]>([]);
/** Set by the page so config-level help can translate messages that carry values. */
let translate: (key: string, params?: Record<string, string | number>) => string = (key) => key;

/** Form currency text (e.g. "1.234,56") as a number. */
function amountValue(value: unknown): number {
  if (typeof value === 'number') return value;
  const raw = String(value ?? '').replace(/[^\d,.-]/g, '');
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Same gross-up as the API: total = (amount + fixed) / (1 − percent), rounded up to the cent. */
export function cardTopupTotal(amount: number, method: TopupMethod | undefined) {
  if (!method || method.method !== 'CREDIT_CARD' || amount <= 0) return null;
  const amountCents = Math.round(amount * 100);
  const gross = (amountCents + Math.round(method.feeFixed * 100)) / (1 - method.feePercent / 100);
  const totalCents = Math.max(amountCents, Math.ceil(gross - 1e-6));
  return { surcharge: (totalCents - amountCents) / 100, total: totalCents / 100 };
}

function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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

/** Fields of GET /billing/identity shown as the payer of a top-up. */
type TenantPayerSummary = {
  IsComplete?: number;
  TidLegalName?: string | null;
  TaxIdLabel?: string | null;
  TaxIdDisplay?: string | null;
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
      visible: (row) => isPending(row) && Boolean(row['BpiCheckoutUrl']),
    },
    { key: 'copy-pix', label: 'Copy Pix code', icon: 'qr_code_2', visible: isPendingBoleto },
    {
      key: 'copy-boleto',
      label: 'Copy boleto line',
      icon: 'receipt_long',
      visible: isPendingBoleto,
    },
    { key: 'boleto', label: 'Download boleto', icon: 'download', visible: isPendingBoleto },
    { key: 'sync', label: 'Check payment', icon: 'sync', visible: isPending },
    {
      key: 'view-receipt',
      label: 'View receipt',
      icon: 'receipt_long',
      visible: (row) => isPaid(row) && Boolean(row['BpiCheckoutUrl']),
    },
  ],
  statusMode: 'string',
  activeValue: 'PAID',
  inactiveValue: 'FAILED',
  activeStatusValues: ['PAID'],
  statusOptions: TOPUP_STATUS_OPTIONS,
  initialValues: {
    payer: '',
    paymentMethod: 'PIX_BOLETO',
    amount: '',
    reference: '',
    dueDate: '',
    idempotencyKey: '',
  },
  columns: [
    { id: 'id', label: 'Reference', kind: 'identity', field: 'BpiID', uuidField: 'BpiUUID' },
    { id: 'amount', label: 'Amount', field: 'BpiAmount' },
    {
      id: 'method',
      label: 'Payment method',
      field: 'BpiPaymentMethod',
      options: [
        { value: 'PIX_BOLETO', label: 'Pix or boleto' },
        { value: 'CREDIT_CARD', label: 'Credit card' },
      ],
    },
    { id: 'charge', label: 'Total charged', field: 'BpiChargeAmount' },
    { id: 'currency', label: 'Currency', field: 'BpiCurrency' },
    {
      id: 'provider',
      label: 'Bank',
      field: 'PbcProvider',
      options: [
        { value: 'inter_business', label: 'Inter Empresas' },
        { value: 'asaas', label: 'Asaas' },
      ],
      translateValue: false,
    },
    { id: 'created', label: 'Created at', kind: 'datetime', field: 'BpiDateCreated' },
    { id: 'expires', label: 'Expires at', kind: 'datetime', field: 'BpiExpiresAt' },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'BpiStatus',
      options: TOPUP_STATUS_OPTIONS,
      chipClass: (val) => {
        const s = String(val ?? '').toUpperCase();
        if (s === 'PAID') return 'chip-success is-active';
        if (s === 'PENDING') return 'chip-warning';
        if (s === 'FAILED') return 'chip-failed';
        return 'chip-skipped is-inactive';
      },
    },
  ],
  fields: [
    {
      key: 'payer',
      label: 'Payer',
      type: 'text',
      span: 2,
      lineFillAfter: 2,
      disabledWhen: () => true,
      help: 'The payer is the tenant tax identity. Change it in Billing > Tax identity.',
    },
    { key: 'amount', label: 'Amount', type: 'currency', span: 1, required: true },
    {
      key: 'paymentMethod',
      label: 'Payment method',
      type: 'select',
      span: 1,
      required: true,
      helpWhen: ({ values }) => {
        if (values['paymentMethod'] !== 'CREDIT_CARD') {
          return 'Pix credits the wallet right away; boleto only after bank clearing (1 to 2 business days).';
        }
        const method = topupMethods().find((item) => item.method === 'CREDIT_CARD');
        const card = cardTopupTotal(amountValue(values['amount']), method);
        return card
          ? translate('Card fee: {{fee}} — Total to pay: {{total}}', {
              fee: formatBrl(card.surcharge),
              total: formatBrl(card.total),
            })
          : 'The card fee is added to the amount. No installments.';
      },
    },
    { key: 'dueDate', label: 'Due date', type: 'date', span: 1 },
    { key: 'reference', label: 'Reference', type: 'text', span: 1 },
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
  private readonly router = inject(Router);

  constructor() {
    super(TOPUPS_CONFIG);
    translate = (key, params) => this.t(key, params);
    void this.loadTopupMethods();
  }

  protected override lookupOptions(key: string) {
    if (key !== 'paymentMethod') return super.lookupOptions(key);
    const methods = topupMethods();
    return (methods.length ? methods.map((item) => item.method) : ['PIX_BOLETO']).map((value) => ({
      value,
      label: METHOD_LABELS[value] ?? value,
    }));
  }

  private async loadTopupMethods(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: TopupMethod[] } }>(
        'billing/topup-methods',
      );
      topupMethods.set(response.data?.items ?? []);
    } catch {
      topupMethods.set([]);
    }
  }

  override startCreate(): void {
    void this.startCreateWithIdentity();
  }

  /** The payer is the tenant tax identity; without a complete one the user is sent to fill it in. */
  private async startCreateWithIdentity(): Promise<void> {
    let payer = '';
    try {
      const response = await this.api.get<{ data?: { item?: TenantPayerSummary } }>(
        'billing/identity',
      );
      const identity = response.data?.item;
      if (!identity?.IsComplete) {
        this.snack.warning(this.t('Fill in the tax identity to add credit to the wallet.'));
        await this.router.navigate(['/billing/identity']);
        return;
      }
      payer = [identity.TidLegalName, [identity.TaxIdLabel, identity.TaxIdDisplay].join(' ')]
        .filter((part) => part?.trim())
        .join(' · ');
    } catch {
      // The API still refuses the top-up with TENANT_IDENTITY_REQUIRED.
    }
    super.startCreate();
    this.patchFormValues({ payer, idempotencyKey: crypto.randomUUID() });
  }

  /** The bank payer is resolved by the API from the tenant identity; only the charge is sent. */
  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      amount: payload['amount'],
      reference: payload['reference'],
      dueDate: payload['dueDate'],
      idempotencyKey: payload['idempotencyKey'],
      paymentMethod: payload['paymentMethod'] || 'PIX_BOLETO',
    };
  }

  protected override afterSave(
    context: ConfigurableCrudSaveContext<BillingPaymentIntent & ConfigurableCrudRecord>,
  ): void {
    const item = (context.response as { data?: { item?: BillingPaymentIntent } })?.data?.item;
    if (!item || context.mode !== 'create') return;
    if (item.BpiCheckoutUrl) {
      // Card: the payer enters the card on the bank-hosted page, never in the platform.
      const popup = window.open(item.BpiCheckoutUrl, '_blank', 'noopener,noreferrer');
      if (popup) popup.opener = null;
      this.snack.success(
        this.t('Complete the card payment on the bank page. If it did not open, use Open payment.'),
      );
      return;
    }
    this.snack.success(this.t('Payment request is ready. Use the action in the list to continue.'));
  }

  override async handleRowAction(
    action: { key: string },
    row: BillingPaymentIntent & ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key === 'open-checkout' || action.key === 'view-receipt') {
      if (!row.BpiCheckoutUrl) return;
      const popup = window.open(row.BpiCheckoutUrl, '_blank', 'noopener,noreferrer');
      if (popup) popup.opener = null;
      return;
    }
    if (action.key === 'boleto') {
      await this.downloadBoleto(row);
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

  /** Boleto PDF read from the issuing bank (Inter) or the bank-hosted document (Asaas). */
  private async downloadBoleto(row: BillingPaymentIntent): Promise<void> {
    try {
      const response = await this.api.get<{
        data?: { item?: { fileName: string; contentType: string; base64?: string; url?: string } };
      }>(`billing/topups/${row.BpiUUID}/boleto`);
      const item = response.data?.item;
      if (item?.url) {
        const popup = window.open(item.url, '_blank', 'noopener,noreferrer');
        if (popup) popup.opener = null;
        return;
      }
      if (!item?.base64) throw new Error('Boleto not available.');
      const bytes = Uint8Array.from(atob(item.base64), (char) => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: item.contentType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = item.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.snack.error(this.errorMessage(error));
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
