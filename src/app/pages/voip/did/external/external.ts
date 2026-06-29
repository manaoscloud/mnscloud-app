import { Component, inject } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipDidExternalItem, VoipDidExternalService } from './external.service';

const BILLING_INTERVAL_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'USAGE', label: 'Usage' },
];

function isSystemScope() {
  return globalThis.location?.pathname.startsWith('/system/') ?? false;
}

function externalConfig(system: boolean): ConfigurableCrudConfig {
  return {
    endpoint: system ? 'system/voip/did/external' : 'voip/did/external',
    uuidField: 'VddUUID',
    pageTitle: 'External DID numbers',
    pageDescription: system
      ? 'Review tenant-owned external DIDs and control validation status.'
      : 'Manage external DID numbers owned by this tenant.',
    createTitle: 'New external DID',
    editTitle: 'Edit external DID',
    dialogDescription: 'Maintain external DID provider, validation, and billing data.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No external DIDs found.',
    deleteTitle: 'Delete external DID',
    deleteMessage: 'Are you sure you want to delete this external DID?',
    deleteSelectedTitle: 'Delete selected external DIDs',
    deleteSelectedMessage: 'Delete {count} selected external DIDs?',
    savedMessage: 'External DID saved successfully.',
    deletedMessage: 'External DID deleted successfully.',
    deleteFailedMessage: 'Failed to delete external DID.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    canCreate: !system,
    canEdit: !system,
    canDelete: true,
    bulkDelete: false,
    rowActions: system
      ? [{ key: 'toggle-status', label: 'Update status', icon: 'verified' }]
      : [{ key: 'start-validation', label: 'Start validation', icon: 'rule' }],
    initialValues: {
      number: '',
      providerName: '',
      providerAccount: '',
      allowedSources: '',
      billingAmount: 0,
      billingCurrency: 'BRL',
      billingInterval: 'MONTHLY',
      notes: '',
    },
    columns: [
      { id: 'number', label: 'Number', kind: 'identity', field: 'VddNumber', uuidField: 'VddUUID' },
      { id: 'provider', label: 'Provider', field: 'VddExternalProviderName' },
      { id: 'tenant', label: 'Tenant', field: 'TenantName' },
      { id: 'validation', label: 'Validation', field: 'VddValidationStatus' },
      { id: 'billing', label: 'Billing', field: 'VddBillingStatus' },
      { id: 'status', label: 'Status', kind: 'status', field: 'VddStatus', className: 'status-col' },
    ],
    fields: [
      {
        key: 'number',
        source: 'VddNumber',
        payloadKey: 'number',
        label: 'Number',
        required: true,
        span: 1,
      },
      {
        key: 'providerName',
        source: 'VddExternalProviderName',
        payloadKey: 'providerName',
        label: 'Provider',
        required: true,
        span: 1,
      },
      {
        key: 'providerAccount',
        source: 'VddExternalProviderAccount',
        payloadKey: 'providerAccount',
        label: 'Provider account',
        span: 1,
      },
      {
        key: 'allowedSources',
        source: 'VddExternalAllowedSources',
        payloadKey: 'allowedSources',
        label: 'Allowed sources',
        span: 1,
      },
      {
        key: 'billingAmount',
        source: 'VddBillingAmount',
        payloadKey: 'billingAmount',
        label: 'Billing amount',
        type: 'number',
        tab: 'financial',
        span: 1,
      },
      {
        key: 'billingCurrency',
        source: 'VddBillingCurrency',
        payloadKey: 'billingCurrency',
        label: 'Currency',
        tab: 'financial',
        span: 1,
      },
      {
        key: 'billingInterval',
        source: 'VddBillingInterval',
        payloadKey: 'billingInterval',
        label: 'Billing interval',
        type: 'select',
        options: BILLING_INTERVAL_OPTIONS,
        tab: 'financial',
        span: 1,
      },
      {
        key: 'notes',
        source: 'VddExternalRoutingInstructions',
        payloadKey: 'notes',
        label: 'Notes',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-did-external',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipDidExternalPage extends ConfigurableCrudPageBase<VoipDidExternalItem> {
  private readonly externalApi = inject(VoipDidExternalService);
  private readonly system = isSystemScope();

  constructor() {
    super(externalConfig(isSystemScope()));
  }

  override rowActions(row: VoipDidExternalItem): readonly ConfigurableCrudRowAction[] {
    if (this.system) {
      const active = String(row.VddValidationStatus ?? '').toUpperCase() === 'ACTIVE';
      return [
        {
          key: active ? 'suspend' : 'activate',
          label: active ? 'Suspend external DID' : 'Activate external DID',
          icon: active ? 'block' : 'verified',
        },
      ];
    }
    return [{ key: 'start-validation', label: 'Start validation', icon: 'rule' }];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: VoipDidExternalItem) {
    if (action.key === 'start-validation') {
      const confirmed = await this.confirmAction(
        'Start validation',
        `Start validation for external DID "${row.VddNumber}"?`,
        'Start validation',
      );
      if (!confirmed) return;
      await this.externalApi.startValidation(row.VddUUID, {});
      this.snack.success('External DID validation started.');
      this.refreshList();
      return;
    }

    if (action.key === 'activate' || action.key === 'suspend') {
      const activate = action.key === 'activate';
      const confirmed = await this.confirmAction(
        activate ? 'Activate external DID' : 'Suspend external DID',
        `${activate ? 'Activate' : 'Suspend'} external DID "${row.VddNumber}"?`,
        activate ? 'Activate' : 'Suspend',
      );
      if (!confirmed) return;
      await this.externalApi.setStatus(row.VddUUID, {
        validationStatus: activate ? 'ACTIVE' : 'SUSPENDED',
        billingStatus: activate ? 'BILLABLE' : 'SUSPENDED',
      });
      this.snack.success('External DID status updated.');
      this.refreshList();
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      number: String(payload['number'] ?? '').replace(/\D+/g, ''),
      billingAmount: Number(payload['billingAmount'] ?? 0),
      billingCurrency: String(payload['billingCurrency'] ?? 'BRL').toUpperCase(),
    };
  }
}
