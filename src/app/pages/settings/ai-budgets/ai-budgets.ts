import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

export const AI_BUDGET_SCOPE_OPTIONS = [
  { value: 'platform', label: 'Platform' },
  { value: 'feature', label: 'Feature' },
  { value: 'tenant', label: 'Tenant' },
] as const;

export const AI_BUDGET_PERIOD_OPTIONS = [
  { value: 'month', label: 'Monthly' },
  { value: 'day', label: 'Daily' },
] as const;

export function aiBudgetScopeLabel(scope: unknown): string {
  return (
    AI_BUDGET_SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? String(scope ?? '')
  );
}

export function aiBudgetPeriodLabel(period: unknown): string {
  return (
    AI_BUDGET_PERIOD_OPTIONS.find((option) => option.value === period)?.label ??
    String(period ?? '')
  );
}

const config = defineCrud({
  endpoint: 'system/ai/budgets',
  uuidField: 'BudgetUUID',
  pageTitle: 'AI budgets',
  pageDescription:
    'Platform, feature and tenant AI budget caps with alert thresholds and hard stops.',
  createTitle: 'Configure AI budget',
  editTitle: 'Edit AI budget',
  dialogDescription:
    'Configure monthly or daily budget caps in USD with hard stops and alert notifications at 50%, 80%, and 100% consumption.',
  searchPlaceholder: 'Scope, feature or tenant',
  emptyLabel: 'No AI budgets configured.',
  deleteTitle: 'Remove AI budget',
  deleteMessage:
    'Remove this budget cap? Features under this scope will operate without this budget limit.',
  savedMessage: 'AI budget saved successfully.',
  deletedMessage: 'AI budget removed.',
  deleteFailedMessage: 'Failed to remove the AI budget.',
  bulkDelete: false,
  serverSidePagination: false,
  statusFilter: false,
  canDelete: false,
  initialValues: {
    scope: 'platform',
    target: '',
    period: 'month',
    amountUsd: 100,
    hardStop: 1,
    alert50: 1,
    alert80: 1,
    alert100: 1,
    status: 1,
  },
  columns: [
    {
      id: 'scope',
      field: 'Scope',
      label: 'Scope',
      kind: 'identity',
      value: (row, translate) => translate(aiBudgetScopeLabel(row['Scope'])),
      detail: (row) => String(row['Feature'] || row['TenantUUID'] || 'Platform-wide'),
    },
    {
      id: 'period',
      field: 'Period',
      label: 'Period',
      value: (row, translate) => translate(aiBudgetPeriodLabel(row['Period'])),
    },
    {
      id: 'amount',
      field: 'AmountUsd',
      label: 'Budget (USD)',
      value: (row) => `$${Number(row['AmountUsd'] ?? 0).toFixed(2)}`,
    },
    {
      id: 'spent',
      field: 'SpentUsd',
      label: 'Spent (USD)',
      value: (row) => `$${Number(row['SpentUsd'] ?? 0).toFixed(2)}`,
    },
    {
      id: 'hardStop',
      field: 'HardStop',
      label: 'Hard stop',
      value: (row, translate) => (row['HardStop'] ? translate('Yes') : translate('No')),
    },
    {
      id: 'alerts',
      field: 'Alerts',
      label: 'Alert thresholds',
      value: (row) => {
        const parts: string[] = [];
        if (row['AlertPercent50']) parts.push('50%');
        if (row['AlertPercent80']) parts.push('80%');
        if (row['AlertPercent100']) parts.push('100%');
        return parts.length ? parts.join(', ') : '-';
      },
    },
    { id: 'status', field: 'Status', label: 'Status', kind: 'status' },
  ],
  fields: [
    {
      key: 'scope',
      label: 'Scope',
      type: 'search-select',
      required: true,
      options: AI_BUDGET_SCOPE_OPTIONS,
      translateOptions: true,
      span: 1,
      help: 'Platform applies to all platform AI operations; Feature caps a specific capability; Tenant caps an individual tenant.',
    },
    {
      key: 'target',
      label: 'Target',
      type: 'text',
      span: 1,
      placeholder: 'Feature code or Tenant UUID',
      help: 'Leave empty for platform scope. For feature, specify the feature code (e.g. support.triage). For tenant, specify the Tenant UUID.',
    },
    {
      key: 'period',
      label: 'Period',
      type: 'search-select',
      required: true,
      options: AI_BUDGET_PERIOD_OPTIONS,
      translateOptions: true,
      span: 1,
      help: 'Budget window resets at the start of each UTC day or month.',
    },
    {
      key: 'amountUsd',
      label: 'Amount (USD)',
      type: 'number',
      required: true,
      span: 1,
      placeholder: '100.00',
      help: 'Maximum USD amount allowed during the period.',
    },
    {
      key: 'hardStop',
      label: 'Hard stop',
      type: 'search-select',
      required: true,
      options: [
        { value: 1, label: 'Enforce hard stop' },
        { value: 0, label: 'Alert only' },
      ],
      translateOptions: true,
      span: 1,
      help: 'When enforced, calls exceeding the budget are blocked with an error.',
    },
    {
      key: 'alert50',
      label: 'Alert at 50%',
      type: 'search-select',
      required: true,
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
      translateOptions: true,
      span: 1,
      help: 'Send notification when spending reaches 50% of the budget.',
    },
    {
      key: 'alert80',
      label: 'Alert at 80%',
      type: 'search-select',
      required: true,
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
      translateOptions: true,
      span: 1,
      help: 'Send notification when spending reaches 80% of the budget.',
    },
    {
      key: 'alert100',
      label: 'Alert at 100%',
      type: 'search-select',
      required: true,
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
      translateOptions: true,
      span: 1,
      help: 'Send notification when spending reaches 100% of the budget.',
    },
    {
      key: 'status',
      label: 'Status',
      type: 'search-select',
      required: true,
      options: [
        { value: 1, label: 'Active' },
        { value: 0, label: 'Inactive' },
      ],
      translateOptions: true,
      span: 1,
      help: 'Inactive budgets are ignored during reservation checks.',
    },
  ],
  payload: (values) => ({
    scope: values['scope'],
    target: values['target'] ? String(values['target']).trim() : null,
    period: values['period'] || 'month',
    amountUsd: Number(values['amountUsd'] ?? 0),
    hardStop: Number(values['hardStop'] ?? 1),
    alert50: Number(values['alert50'] ?? 1),
    alert80: Number(values['alert80'] ?? 1),
    alert100: Number(values['alert100'] ?? 1),
    status: Number(values['status'] ?? 1),
  }),
});

@Component({
  selector: 'app-ai-budgets',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AiBudgetsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    if (this.editingRecord() ? !this.canEdit() : !this.canCreate()) return;
    this.clearFieldErrors(null);
    const formPayload = this.config.payload
      ? this.config.payload(this.formValues(), Boolean(this.editingRecord()))
      : this.formValues();
    if (!this.validatePayload(formPayload)) return;

    this.saving.set(true);
    try {
      const payload = this.augmentPayload(formPayload);
      const current = this.editingRecord();
      await this.api.put('system/ai/budgets', {
        ...payload,
        ...(current?.['Revision'] ? { expectedRevision: Number(current['Revision']) } : {}),
      });
      this.snack.success(this.t(this.config.savedMessage));
      this.itemsResource.reload();
      if (saveAndNew) {
        this.resetFieldErrors();
        this.editingRecord.set(null);
        this.formValues.set({});
      } else {
        this.closeDialog();
      }
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.saving.set(false);
    }
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    const editRecord: ConfigurableCrudRecord = {
      ...row,
      scope: row['Scope'],
      target: row['Feature'] || row['TenantUUID'] || '',
      period: row['Period'],
      amountUsd: row['AmountUsd'],
      hardStop: row['HardStop'],
      alert50: row['AlertPercent50'],
      alert80: row['AlertPercent80'],
      alert100: row['AlertPercent100'],
      status: row['Status'],
    };
    super.startEdit(editRecord);
  }
}
