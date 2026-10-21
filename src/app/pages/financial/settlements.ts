import { ConfigurableCrudRecord } from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

const ORIGINS = [
  { value: 'manual', label: 'Manual' },
  { value: 'gateway', label: 'Payment gateway' },
  { value: 'pos', label: 'POS' },
  { value: 'terminal', label: 'Card terminal' },
  { value: 'reversal', label: 'Reversal' },
];

/**
 * Receipts or payments of one title (partial allowed) and their reversals. The title balance and
 * the paid/partial status come only from these settlements; a wrong one is reversed, never edited.
 */
export function settlementsCollection(direction: 'receivable' | 'payable', uuidField: string) {
  return (title: ConfigurableCrudRecord) => {
    const titleUUID = String(title[uuidField]);
    const open = Number(title['OpenAmount'] ?? title['Amount'] ?? 0);
    return defineCrud({
      endpoint: 'financial/settlements',
      listQuery: { direction, titleUUID },
      uuidField: 'FstUUID',
      pageTitle: direction === 'receivable' ? 'Receipts' : 'Payments',
      pageDescription:
        direction === 'receivable'
          ? 'Receipts of this receivable, partial or full, and their reversals.'
          : 'Payments of this payable, partial or full, and their reversals.',
      createTitle: direction === 'receivable' ? 'New receipt' : 'New payment',
      canEdit: false,
      canDelete: false,
      canCreate: open > 0,
      bulkDelete: false,
      statusFilter: false,
      initialValues: {
        amount: open,
        paidAt: '',
        payMethodUUID: '',
        externalReference: '',
        notes: '',
      },
      columns: [
        { id: 'id', label: 'ID', field: 'FstID', uuidField: 'FstUUID', kind: 'identity' },
        { id: 'paidAt', label: 'Paid at', field: 'FstPaidAt', kind: 'datetime' },
        { id: 'amount', label: 'Amount', field: 'FstAmount', kind: 'currency' },
        { id: 'method', label: 'Payment method', field: 'PayMethodName' },
        { id: 'origin', label: 'Origin', field: 'FstOrigin', options: ORIGINS },
        { id: 'reference', label: 'Reference', field: 'FstExternalReference' },
      ],
      fields: [
        {
          key: 'amount',
          label: 'Amount',
          type: 'currency',
          required: true,
          help: 'Up to the open balance of the title.',
          span: 1,
        },
        { key: 'paidAt', label: 'Paid at', type: 'datetime', span: 1 },
        {
          key: 'payMethodUUID',
          source: 'FinPayMethodFpmUUID',
          label: 'Payment method',
          type: 'search-select',
          remoteLookup: {
            endpoint: 'financial/payment-methods?status=1',
            uuidField: 'FinPayMethodUUID',
            labelField: 'Name',
          },
          span: 2,
        },
        {
          key: 'externalReference',
          label: 'Reference',
          help: 'Bank, terminal or receipt reference; the same reference is never settled twice.',
          span: 2,
        },
        { key: 'notes', label: 'Notes', span: 2 },
      ],
      rowActions: [
        {
          key: 'reverse',
          label: 'Reverse',
          icon: 'undo',
          visible: (row) =>
            Number(row['FstAmount']) > 0 &&
            !row['ReversedByFstUUID'] &&
            row['FstOrigin'] !== 'reversal',
          request: {
            method: 'post',
            endpoint: (row) => `financial/settlements/${row['FstUUID']}/reversal`,
            successMessage: 'Settlement reversed.',
            confirm: {
              title: 'Reverse settlement',
              message: 'Post the opposite entry and reopen this amount on the title?',
              confirmLabel: 'Reverse',
            },
          },
        },
      ],
      payload: (values) => ({
        direction,
        titleUUID,
        amount: Number(values['amount']),
        paidAt: values['paidAt'] || null,
        payMethodUUID: values['payMethodUUID'] || null,
        origin: 'manual',
        externalReference: String(values['externalReference'] ?? '').trim() || null,
        notes: String(values['notes'] ?? '').trim() || null,
      }),
    });
  };
}
