import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BILLING_STATUS_OPTIONS, numberOrNull } from '../../shared/billing-crud';

const isPlatform = (row: ConfigurableCrudRecord | null | undefined) =>
  Number(row?.['IsPlatform'] ?? 0) === 1;

/** Own value of the row, or "Inherits (N)" when a tenant override leaves it empty. */
const ownOrInherited =
  (own: string, effective: string) =>
  (row: ConfigurableCrudRecord, translate: (key: string) => string) =>
    row[own] === null || row[own] === undefined || row[own] === ''
      ? `${translate('Inherits')} (${row[effective]})`
      : String(row[own]);

const BILLING_PARAMETER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/billing/parameters',
  uuidField: 'BptUUID',
  pageTitle: 'Billing parameters',
  pageDescription:
    'Collection policy: platform defaults and per-tenant exceptions for the grace period before an unpaid service is blocked and the period before it is released.',
  createTitle: 'New tenant exception',
  editTitle: 'Edit billing parameters',
  dialogDescription:
    'Empty values inherit the platform defaults. Periods count from the first failed renewal.',
  searchPlaceholder: 'Search tenant',
  emptyLabel: 'No billing parameters found.',
  deleteTitle: 'Delete tenant exception',
  deleteMessage: 'Delete this exception? The tenant returns to the platform defaults.',
  deleteSelectedTitle: 'Delete selected exceptions',
  deleteSelectedMessage: 'Delete {count} selected exceptions?',
  savedMessage: 'Billing parameters saved successfully.',
  deletedMessage: 'Tenant exception deleted successfully.',
  deleteFailedMessage: 'Failed to delete tenant exception.',
  bulkDelete: false,
  canDeleteRow: (row) => !isPlatform(row),
  ...BILLING_STATUS_OPTIONS,
  initialValues: {
    tenantUUID: '',
    suspensionGraceDays: null,
    suspensionReleaseDays: null,
    signupTrialEnabled: false,
    signupTrialAmount: 0,
    signupTrialCurrency: 'BRL',
    signupTrialExpiresDays: 15,
    signupTrialRequireEmailVerified: true,
    notes: '',
    status: 1,
  },
  columns: [
    {
      id: 'scope',
      label: 'Scope',
      kind: 'identity',
      field: 'TenantLabel',
      uuidField: 'BptUUID',
      value: (row, translate) =>
        isPlatform(row) ? translate('Platform defaults') : String(row['TenantLabel'] ?? ''),
      detail: (row, translate) =>
        isPlatform(row) ? translate('Applies to every tenant') : String(row['TenantEmail'] ?? ''),
    },
    {
      id: 'grace',
      label: 'Grace period (days)',
      field: 'BptSuspensionGraceDays',
      value: ownOrInherited('BptSuspensionGraceDays', 'EffectiveGraceDays'),
    },
    {
      id: 'release',
      label: 'Release after (days)',
      field: 'BptSuspensionReleaseDays',
      value: ownOrInherited('BptSuspensionReleaseDays', 'EffectiveReleaseDays'),
    },
    { id: 'notes', label: 'Reason', field: 'BptNotes' },
    { id: 'status', label: 'Status', kind: 'status', field: 'BptStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'BptStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      hiddenWhen: ({ values }) => isPlatform(values),
    },
    {
      key: 'tenantUUID',
      source: 'UserUsrUUID',
      payloadKey: 'tenantUUID',
      label: 'Tenant',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'system/billing/tenants',
        uuidField: 'EnvironmentUUID',
        labelField: 'EnvironmentName',
        descriptionField: 'TenantEmail',
        selectedLabelField: 'TenantLabel',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'Tenants are provisioned through onboarding; there is no in-place create form.',
      required: true,
      hiddenWhen: ({ editing }) => editing,
      span: 2,
    },
    {
      key: 'suspensionGraceDays',
      source: 'BptSuspensionGraceDays',
      payloadKey: 'suspensionGraceDays',
      label: 'Grace period (days)',
      type: 'number',
      requiredWhen: ({ values }) => isPlatform(values),
      breakBefore: true,
      span: 1,
      help: 'Days an unpaid subscription keeps working after the renewal fails. Afterwards the service is blocked (module access denied, DIDs stop receiving calls) until credit is added.',
    },
    {
      key: 'suspensionReleaseDays',
      source: 'BptSuspensionReleaseDays',
      payloadKey: 'suspensionReleaseDays',
      label: 'Release after (days)',
      type: 'number',
      requiredWhen: ({ values }) => isPlatform(values),
      span: 1,
      help: 'Days after the failed renewal before the subscription is canceled and its resource released (DIDs return to inventory). Must be longer than the grace period; tenants are warned 7 days before.',
    },
    {
      key: 'signupTrialAmount',
      source: 'BptSignupTrialAmount',
      payloadKey: 'signupTrialAmount',
      label: 'Trial Credit Amount',
      type: 'number',
      hiddenWhen: ({ values }) => !isPlatform(values),
      breakBefore: true,
      span: 1,
      help: 'Initial credit amount automatically granted to new self-registered customer accounts.',
    },
    {
      key: 'signupTrialCurrency',
      source: 'BptSignupTrialCurrency',
      payloadKey: 'signupTrialCurrency',
      label: 'Trial Credit Currency',
      type: 'text',
      hiddenWhen: ({ values }) => !isPlatform(values),
      span: 1,
      placeholder: 'BRL',
      help: 'Currency code for the welcome signup credit (ISO 4217, e.g. BRL).',
    },
    {
      key: 'signupTrialExpiresDays',
      source: 'BptSignupTrialExpiresDays',
      payloadKey: 'signupTrialExpiresDays',
      label: 'Trial Expires Days',
      type: 'number',
      hiddenWhen: ({ values }) => !isPlatform(values),
      span: 1,
      help: 'Number of calendar days after signup before remaining trial credit expires.',
    },
    {
      key: 'signupTrialEnabled',
      source: 'BptSignupTrialEnabled',
      payloadKey: 'signupTrialEnabled',
      label: 'Trial Credit Active',
      type: 'select',
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
      hiddenWhen: ({ values }) => !isPlatform(values),
      span: 1,
      help: 'Enable signup trial credit after account verification.',
    },
    {
      key: 'signupTrialRequireEmailVerified',
      source: 'BptSignupTrialRequireEmailVerified',
      payloadKey: 'signupTrialRequireEmailVerified',
      label: 'Require Verified Email',
      type: 'select',
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
      hiddenWhen: ({ values }) => !isPlatform(values),
      breakBefore: true,
      span: 1,
      lineFillAfter: 3,
      help: 'Apply signup trial credit only after e-mail verification.',
    },
    {
      key: 'notes',
      source: 'BptNotes',
      payloadKey: 'notes',
      label: 'Reason',
      type: 'textarea',
      span: 4,
      rows: 2,
      placeholder: 'Corporate contract',
    },
  ],
};

@Component({
  selector: 'app-billing-system-parameters',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class BillingSystemParametersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(BILLING_PARAMETER_CONFIG);
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    // Keeps the scope flag in the form so platform-only rules apply.
    const values = super.formValuesFromRecord(row);
    return {
      ...values,
      IsPlatform: row['IsPlatform'],
      signupTrialEnabled: row['BptSignupTrialEnabled'] !== null && row['BptSignupTrialEnabled'] !== undefined
        ? Number(row['BptSignupTrialEnabled']) === 1 ? 1 : 0
        : 0,
      signupTrialAmount: row['BptSignupTrialAmount'] !== null && row['BptSignupTrialAmount'] !== undefined
        ? Number(row['BptSignupTrialAmount'])
        : 0,
      signupTrialCurrency: String(row['BptSignupTrialCurrency'] ?? 'BRL').trim().toUpperCase() || 'BRL',
      signupTrialExpiresDays: row['BptSignupTrialExpiresDays'] !== null && row['BptSignupTrialExpiresDays'] !== undefined
        ? Number(row['BptSignupTrialExpiresDays'])
        : 15,
      signupTrialRequireEmailVerified: row['BptSignupTrialRequireEmailVerified'] !== null && row['BptSignupTrialRequireEmailVerified'] !== undefined
        ? Number(row['BptSignupTrialRequireEmailVerified']) === 1 ? 1 : 0
        : 1,
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const isPlatformRow = isPlatform(this.editingRecord()) || isPlatform(payload);
    const result: ConfigurableCrudRecord = {
      tenantUUID: payload['tenantUUID'] || null,
      suspensionGraceDays: numberOrNull(payload['suspensionGraceDays']),
      suspensionReleaseDays: numberOrNull(payload['suspensionReleaseDays']),
      notes: String(payload['notes'] ?? '').trim() || null,
      status: Number(payload['status'] ?? 1) === 0 ? 0 : 1,
    };
    if (isPlatformRow) {
      result['signupTrialEnabled'] = Number(payload['signupTrialEnabled'] ?? 0) === 1;
      result['signupTrialAmount'] = Math.max(Number(payload['signupTrialAmount'] ?? 0), 0);
      result['signupTrialCurrency'] = (String(payload['signupTrialCurrency'] ?? 'BRL').trim() || 'BRL').toUpperCase();
      result['signupTrialExpiresDays'] = Math.min(Math.max(Number(payload['signupTrialExpiresDays'] ?? 15), 1), 365);
      result['signupTrialRequireEmailVerified'] = Number(payload['signupTrialRequireEmailVerified'] ?? 1) === 1;
    }
    return result;
  }
}
