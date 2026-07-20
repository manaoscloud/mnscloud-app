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
  rowActions: [{ key: 'open-checkout', label: 'Open payment', icon: 'open_in_new' }],
  ...BILLING_STATUS_OPTIONS,
  initialValues: {
    amount: '',
    reference: '',
    payerName: '',
    payerDocument: '',
    payerEmail: '',
    payerType: 'FISICA',
    dueDate: '',
    idempotencyKey: '',
  },
  columns: [
    { id: 'id', label: 'Reference', kind: 'identity', field: 'BpiID', uuidField: 'BpiUUID' },
    { id: 'amount', label: 'Amount', field: 'BpiAmount' },
    { id: 'currency', label: 'Currency', field: 'BpiCurrency' },
    { id: 'provider', label: 'Provider', field: 'BpiProvider' },
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
    { key: 'idempotencyKey', label: 'Idempotency key', type: 'text', hidden: true },
  ],
};

@Component({
  selector: 'app-billing-tenant-topups',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
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
    const { payerName, payerDocument, payerEmail, payerType, ...request } = payload;
    return {
      ...request,
      payer: {
        nome: payerName,
        cpfCnpj: String(payerDocument ?? '').replace(/\D/g, ''),
        email: payerEmail,
        tipoPessoa: payerType,
      },
    };
  }

  protected override afterSave(
    context: ConfigurableCrudSaveContext<BillingPaymentIntent & ConfigurableCrudRecord>,
  ): void {
    const item = (context.response as { data?: { item?: BillingPaymentIntent } })?.data?.item;
    const checkoutUrl = item?.BpiCheckoutUrl;
    if (!checkoutUrl || context.mode !== 'create') return;
    this.snack.success('Payment request is ready. Use the action in the list to continue.');
  }

  override rowActions(row: BillingPaymentIntent & ConfigurableCrudRecord) {
    return row.BpiCheckoutUrl ? super.rowActions(row) : [];
  }

  override handleRowAction(
    action: { key: string },
    row: BillingPaymentIntent & ConfigurableCrudRecord,
  ): void {
    if (action.key !== 'open-checkout' || !row.BpiCheckoutUrl) return;
    const popup = window.open(row.BpiCheckoutUrl, '_blank', 'noopener,noreferrer');
    if (popup) popup.opener = null;
  }
}
