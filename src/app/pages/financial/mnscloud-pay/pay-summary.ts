import { Component, signal } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

type SummaryRow = ConfigurableCrudRecord & { key: string; item: string; value: string };

const KYC_LABELS: Record<string, string> = {
  APPROVED: 'Approved',
  PENDING: 'Pending',
  AWAITING_APPROVAL: 'Awaiting approval',
  REJECTED: 'Rejected',
};

function brl(value: unknown): string {
  const n = Number(value ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * MNSCloud Pay summary of the tenant (handoff 2026-11-21, G2): verification (KYC), the bank's
 * live subaccount balance and the ledger balances.
 */
@Component({
  selector: 'app-financial-pay-summary',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FinancialPaySummaryPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly summaryRows;
  private readonly summaryLoading;

  constructor() {
    const rows = signal<SummaryRow[]>([]);
    const loading = signal(true);
    super(
      defineCrud({
        endpoint: 'financial/gateway-accounts/mnscloud-pay/summary',
        uuidField: 'key',
        pageTitle: 'MNSCloud Pay summary',
        pageDescription:
          'Account verification, the balance the bank reports and the MNSCloud Pay ledger of your account.',
        readOnly: true,
        pagination: false,
        rows: () => rows(),
        rowsLoading: () => loading(),
        statusFilter: false,
        initialValues: {},
        fields: [],
        columns: [
          { id: 'item', label: 'Item', field: 'item', kind: 'identity' },
          { id: 'value', label: 'Value', field: 'value', translateValue: false },
        ],
      }),
    );
    this.summaryRows = rows;
    this.summaryLoading = loading;
    void this.loadSummary();
  }

  private async loadSummary(): Promise<void> {
    this.summaryLoading.set(true);
    try {
      const res = await this.api.get<{ data?: Record<string, any> }>(
        'financial/gateway-accounts/mnscloud-pay/summary',
      );
      const d = res?.data ?? {};
      const t = (key: string) => this.t(key);
      const kyc = (value: unknown) => t(KYC_LABELS[String(value ?? '')] ?? 'Pending');
      const b = d['balances'] ?? {};
      const rows: SummaryRow[] = d['configured']
        ? [
            { key: 'kyc', item: t('Account verification'), value: kyc(d['kyc']?.general) },
            { key: 'kyc-doc', item: t('Documents'), value: kyc(d['kyc']?.documentation) },
            { key: 'kyc-bank', item: t('Bank account'), value: kyc(d['kyc']?.bankAccount) },
            {
              key: 'bank',
              item: t('Balance at the bank'),
              value: d['bankBalance'] === null ? '—' : brl(d['bankBalance']),
            },
            { key: 'balance', item: t('Subaccount balance'), value: brl(b['subaccount_balance']) },
            {
              key: 'receipts',
              item: t('Received from customers'),
              value: brl(b['customer_receipts']),
            },
            { key: 'fees', item: t('MNSCloud Pay fees'), value: brl(b['fees']) },
            { key: 'transit', item: t('Payouts in transit'), value: brl(b['payout_in_transit']) },
            { key: 'paid', item: t('Paid out to your bank'), value: brl(b['tenant_bank']) },
          ]
        : [
            {
              key: 'none',
              item: t('MNSCloud Pay'),
              value: t('Not configured. Set it up in Financial > Gateways.'),
            },
          ];
      this.summaryRows.set(rows);
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.summaryLoading.set(false);
    }
  }
}
